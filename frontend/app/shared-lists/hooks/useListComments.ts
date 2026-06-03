"use client";

import { useState } from "react";
import { toast } from "sonner";
import { generateOpId, attachOpToBody, attachOpToHeaders, makeTempId } from "@/lib/optimistic";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { useQueryClient } from "@tanstack/react-query";
import type { SharedList, UserProfile } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";
import { applyEntityUpdate } from "@/lib/cacheHelpers";
import { SharedListsSnapshot } from "../lib/types";
import { appendReplyToComments } from "../lib/shared-lists-utils";

/**
 * Manage comment and reply state
 */
export function useListCommentState() {
  const [commentsByList, setCommentsByList] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null);

  const setCommentForList = (listId: string, text: string) => {
    setCommentsByList((current) => ({ ...current, [listId]: text }));
  };

  const setReplyDraft = (commentId: string, text: string) => {
    setReplyDrafts((current) => ({ ...current, [commentId]: text }));
  };

  const clearCommentForList = (listId: string) => {
    setCommentsByList((current) => {
      const next = { ...current };
      delete next[listId];
      return next;
    });
  };

  const clearReplyDraft = (commentId: string) => {
    setReplyDrafts((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  };

  return {
    commentsByList,
    replyDrafts,
    openReplyFor,
    setCommentsByList,
    setReplyDrafts,
    setCommentForList,
    setReplyDraft,
    setOpenReplyFor,
    clearCommentForList,
    clearReplyDraft,
  };
}

/**
 * Post comment or reply to a shared list
 */
export function useAddComment(snapshot: SharedListsSnapshot) {
  const { isInFlight, addInFlightOp, removeInFlightOp } = useOptimisticOps();
  const queryClient = useQueryClient();
  const { currentUser } = snapshot;

  return async (
    listId: string,
    body: string,
    parentId?: string
  ) => {
    if (!currentUser) {
      throw new Error("Sign in to comment.");
    }

    if (!body.trim()) {
      throw new Error("Comment cannot be empty.");
    }

    const opId = parentId ? `shared-list-reply-${parentId}` : `shared-list-comment-${listId}`;
    if (isInFlight(opId)) {
      return;
    }

    addInFlightOp(opId, {
      opId,
      type: parentId ? "reply" : "post",
      surface: "shared-list",
      itemId: listId,
      parentId,
      payload: { body, parentId },
    });

    const previousLists = snapshot.lists;
    const tempCommentId = makeTempId("comment");
    const op = { opId: generateOpId("shared-list-comment"), type: "create" as const, tempId: tempCommentId, ts: Date.now() };
    const optimisticComment: any = {
      id: tempCommentId,
      tempId: tempCommentId,
      opId: op.opId,
      user: currentUser,
      body,
      date: new Date().toISOString(),
      parentId: parentId ?? null,
      replies: [],
    };

    applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
      if (!current) return current;

      return {
        ...current,
        lists: current.lists.map((item: any) => {
          if (item.id !== listId) {
            return item;
          }

          const existingComments = item.commentItems ?? [];
          const updatedComments = parentId
            ? appendReplyToComments(existingComments, parentId, optimisticComment)
            : [...existingComments, optimisticComment];

          return {
            ...item,
            commentItems: updatedComments,
            comments: (item.comments ?? 0) + 1,
          };
        }),
      };
    });

    try {
      const bodyObj = attachOpToBody({ body, parentId }, op);
      const headers = attachOpToHeaders({ "Content-Type": "application/json" }, op);

      const response = await fetch(`/api/shared-lists/${listId}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Could not post the comment.");
      }

      // Server returns canonical lists array
      const nextLists = Array.isArray(payload?.value) ? payload.value : [];
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: nextLists };
      });

      toast.success(parentId ? "Reply posted" : "Comment posted");
    } catch (error) {
      applyEntityUpdate(queryClient, [queryKeys.sharedLists.all()], (current: SharedListsSnapshot | undefined) => {
        if (!current) return current;
        return { ...current, lists: previousLists };
      });
      throw error;
    } finally {
      removeInFlightOp(opId);
    }
  };
}
