"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { SharedListsView } from "./components";
import {
  useSharedListsSnapshot,
  useLoadGroups,
  useSharedListsEvents,
  useCreateList,
  useToggleLike,
  useRemoveList,
  useListCommentState,
  useAddComment,
  useMovieSearch,
  useAddMovieToList,
  useRemoveMovieFromList,
} from "./hooks";
import { useOptimisticOps } from "@/hooks/useOptimisticOps";
import { NewListFormState } from "./lib/types";

export default function SharedListsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Load data
  const { snapshot: baseSnapshot, isLoading } = useSharedListsSnapshot();
  const { groups, loadGroups } = useLoadGroups();
  const snapshot = useMemo(() => ({ ...baseSnapshot, groups }), [baseSnapshot, groups]);
  const { lists, currentUser } = snapshot;

  // UI state management
  const {
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
  } = useListCommentState();

  // Movie search state
  const selectedListId = useMemo(() => searchParams.get("listId"), [searchParams]);
  const movieSearch = useMovieSearch(selectedListId);

  // Operations
  const createList = useCreateList(snapshot);
  const toggleLike = useToggleLike(snapshot);
  const removeList = useRemoveList(snapshot);
  const addComment = useAddComment(snapshot);
  const { addMovieToList, addingToListId } = useAddMovieToList(snapshot);
  const { removeMovieFromList, removingFromListId } = useRemoveMovieFromList(snapshot);
  const { isInFlight } = useOptimisticOps();

  // Real-time updates
  useSharedListsEvents();

  // URL-synced list selection
  const selectedList = useMemo(() => lists.find((list) => list.id === selectedListId) ?? null, [lists, selectedListId]);

  const setSelectedListAndUrl = (listId: string | null) => {
    if (listId) {
      router.push(`${pathname}?listId=${encodeURIComponent(listId)}`);
    } else {
      router.push(pathname);
    }
  };

  // Form state for creating list
  const [formState, setFormState] = useState<NewListFormState>({
    name: "",
    description: "",
    visibility: "public",
    groupId: "",
  });
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (createOpen || formState.visibility === "group") {
      void loadGroups();
    }
  }, [createOpen, formState.visibility, loadGroups]);

  const handleCreateList = async () => {
    try {
      await createList(formState);
      setFormState({ name: "", description: "", visibility: "public", groupId: "" });
      setCreateOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveList = async (id: string) => {
    await removeList(id, () => setSelectedListAndUrl(null));
  };

  const handleAddComment = async (listId: string, parentId?: string) => {
    const text = parentId ? replyDrafts[parentId] : commentsByList[listId];
    try {
      await addComment(listId, text, parentId);
      if (parentId) {
        clearReplyDraft(parentId);
        setOpenReplyFor(null);
      } else {
        clearCommentForList(listId);
      }
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleAddMovie = async (listId: string, movieId: string) => {
    try {
      await addMovieToList(listId, movieId, movieSearch.results);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRemoveMovie = async (listId: string, movieId: string) => {
    try {
      await removeMovieFromList(listId, movieId);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <SharedListsView
      lists={snapshot.lists}
      isLoading={isLoading}
      groups={snapshot.groups}
      currentUser={snapshot.currentUser}
      selectedList={selectedList}
      selectedListId={selectedListId}
      setSelectedListId={setSelectedListAndUrl}
      // Create dialog
      openCreate={createOpen}
      setOpenCreate={setCreateOpen}
      newName={formState.name}
      setNewName={(name) => setFormState({ ...formState, name })}
      newDescription={formState.description}
      setNewDescription={(desc) => setFormState({ ...formState, description: desc })}
      newVisibility={formState.visibility}
      setNewVisibility={(vis) => setFormState({ ...formState, visibility: vis })}
      newGroupId={formState.groupId}
      setNewGroupId={(id) => setFormState({ ...formState, groupId: id })}
      createList={handleCreateList}
      // Comments
      newCommentByList={commentsByList}
      setNewCommentByList={setCommentsByList}
      replyDrafts={replyDrafts}
      setReplyDrafts={setReplyDrafts}
      openReplyFor={openReplyFor}
      setOpenReplyFor={setOpenReplyFor}
      // Movie search
      movieSearchQuery={movieSearch.query}
      setMovieSearchQuery={movieSearch.setQuery}
      movieSearchResults={movieSearch.results}
      movieSearchLoading={movieSearch.isLoading}
      movieSearchError={movieSearch.error}
      addingMovieToListId={addingToListId}
      removingMovieFromListId={removingFromListId}
      isInFlight={isInFlight}
      // List operations
      toggleLike={toggleLike}
      removeList={handleRemoveList}
      addComment={handleAddComment}
      addMovie={handleAddMovie}
      removeMovie={handleRemoveMovie}
    />
  );
}
