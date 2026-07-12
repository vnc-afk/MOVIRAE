"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListPlus,
  Plus,
  Users,
  Globe,
  Film,
  Check,
  X,
  Loader2,
} from "lucide-react";

import { ListCard, PublicListCard, ListDetail, PublicListDetail } from ".";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";

type SharedListsViewProps = {
  lists: SharedList[];
  groups: Group[];
  currentUser: UserProfile | null;
  selectedList: SharedList | null;
  openCreate: boolean;
  setOpenCreate: (value: boolean) => void;
  newName: string;
  setNewName: (value: string) => void;
  newDescription: string;
  setNewDescription: (value: string) => void;
  newVisibility: "public" | "private" | "group";
  setNewVisibility: (value: "public" | "private" | "group") => void;
  newGroupId: string;
  setNewGroupId: (value: string) => void;
  createList: () => void;
  selectedListId: string | null;
  setSelectedListId: (value: string | null) => void;
  newCommentByList: Record<string, string>;
  setNewCommentByList: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  movieSearchQuery: string;
  setMovieSearchQuery: (value: string) => void;
  movieSearchResults: Movie[];
  movieSearchLoading: boolean;
  movieSearchError: string | null;
  addingMovieToListId: string | null;
  removingMovieFromListId: string | null;
  isInFlight: (opId: string) => boolean;
  toggleLike: (list: SharedList) => void;
  removeList: (id: string) => void;
  addComment: (listId: string, parentId?: string) => void;
  addMovie: (listId: string, movieId: string) => void;
  removeMovie: (listId: string, movieId: string) => void;
};

export function SharedListsView({
  lists,
  groups,
  currentUser,
  selectedList,
  openCreate,
  setOpenCreate,
  newName,
  setNewName,
  newDescription,
  setNewDescription,
  newVisibility,
  setNewVisibility,
  newGroupId,
  setNewGroupId,
  createList,
  selectedListId,
  setSelectedListId,
  newCommentByList,
  setNewCommentByList,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  movieSearchQuery,
  setMovieSearchQuery,
  movieSearchResults,
  movieSearchLoading,
  movieSearchError,
  addingMovieToListId,
  removingMovieFromListId,
  isInFlight,
  toggleLike,
  removeList,
  addComment,
  addMovie,
  removeMovie,
}: SharedListsViewProps) {
  // Shared lists view: handles filtering tabs, create dialog, and the list grid.
  // State here is intentionally local and passed down to child components for clarity.
  const [tab, setTab] = useState("all");
  const mine = lists.filter((list) => list.owner.id === currentUser?.id);
  const collaborating = lists.filter((list) => list.collaborators.some((c) => c.id === currentUser?.id));
  const groupLists = lists.filter((list) => list.visibility === "group");
  const activeCommentCount = selectedList?.commentItems?.length ?? selectedList?.comments ?? 0;

  const displayLists =
    tab === "mine" ? mine :
    tab === "collaborating" ? collaborating :
    tab === "group" ? groupLists :
    lists;

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ListPlus className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold text-foreground">Shared Lists</h1>
            </div>
            <p className="text-sm text-muted-foreground">Co-create watchlists with friends, groups, or the community.</p>
          </div>
          {/* Create list dialog: opens a modal form to create new shared lists. */}
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Shared List
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Shared List</DialogTitle>
                <DialogDescription>Create a public, private, or group movie list that others can explore and discuss.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="List name" />
                <Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Description" rows={3} />
                <Select value={newVisibility} onValueChange={(value: "public" | "private" | "group") => setNewVisibility(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>

                {newVisibility === "group" && (
                  <Select value={newGroupId} onValueChange={setNewGroupId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpenCreate(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                  <Button onClick={createList} disabled={isInFlight("shared-list-create")}>
                    {isInFlight("shared-list-create") ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Tabs control which subset of lists is shown: all / mine / collaborating / group */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="all" className="gap-1.5 text-xs"><Globe className="h-3 w-3" /> All</TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5 text-xs"><Film className="h-3 w-3" /> My Lists</TabsTrigger>
            <TabsTrigger value="collaborating" className="gap-1.5 text-xs"><Users className="h-3 w-3" /> Collaborating</TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5 text-xs"><Users className="h-3 w-3" /> Group Lists</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value={tab} className="mt-6">
              {displayLists.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-5">
                  <AnimatePresence>
                    {displayLists.map((list, i) => {
                      const isOwner = currentUser?.id === list.owner.id;
                      const isCollaborator = currentUser ? list.collaborators.some((c) => c.id === currentUser.id) : false;
                      const canEdit = isOwner || isCollaborator;

                      // Choose the editable card for lists the user can modify, otherwise show the public view.
                      return canEdit ? (
                        <ListCard
                          key={list.id}
                          list={list}
                          index={i}
                          currentUser={currentUser}
                          isInFlight={isInFlight}
                          onLike={toggleLike}
                          onDelete={removeList}
                          onOpen={setSelectedListId}
                          addingMovieToListId={addingMovieToListId}
                          removingMovieFromListId={removingMovieFromListId}
                        />
                      ) : (
                        <PublicListCard
                          key={list.id}
                          list={list}
                          index={i}
                          isInFlight={isInFlight}
                          onLike={toggleLike}
                          onOpen={setSelectedListId}
                          addingMovieToListId={addingMovieToListId}
                          removingMovieFromListId={removingMovieFromListId}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ListPlus className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No lists here yet. Create one to get started!</p>
                </div>
              )}
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        <Dialog open={Boolean(selectedList)} onOpenChange={(open) => !open && setSelectedListId(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            {selectedList && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedList.name}</DialogTitle>
                  <DialogDescription>{(() => {
                    const isOwner = currentUser?.id === selectedList.owner.id;
                    const isCollaborator = currentUser ? selectedList.collaborators.some((c) => c.id === currentUser.id) : false;
                    const canEdit = isOwner || isCollaborator;
                    return canEdit ? "View this shared list, discuss it, and add more movies." : "View this shared list and discuss it.";
                  })()}</DialogDescription>
                </DialogHeader>
                {(() => {
                  const isOwner = currentUser?.id === selectedList.owner.id;
                  const isCollaborator = currentUser ? selectedList.collaborators.some((c) => c.id === currentUser.id) : false;
                  const canEdit = isOwner || isCollaborator;

                  return canEdit ? (
                    <ListDetail
                      list={selectedList}
                      groups={groups}
                      currentUser={currentUser}
                      commentCount={activeCommentCount}
                      newComment={newCommentByList[selectedList.id] ?? ""}
                      setNewComment={(value) => setNewCommentByList((current) => ({ ...current, [selectedList.id]: value }))}
                      onCommentSubmit={() => addComment(selectedList.id)}
                      isInFlight={isInFlight}
                      replyDrafts={replyDrafts}
                      setReplyDrafts={setReplyDrafts}
                      openReplyFor={openReplyFor}
                      setOpenReplyFor={setOpenReplyFor}
                      onReplySubmit={(commentId) => addComment(selectedList.id, commentId)}
                      movieSearchQuery={movieSearchQuery}
                      setMovieSearchQuery={setMovieSearchQuery}
                      movieSearchResults={movieSearchResults}
                      movieSearchLoading={movieSearchLoading}
                      movieSearchError={movieSearchError}
                      onAddMovie={addMovie}
                      addingMovieToListId={addingMovieToListId}
                      removingMovieFromListId={removingMovieFromListId}
                      onRemoveMovie={removeMovie}
                      onLike={() => toggleLike(selectedList)}
                      onDelete={() => removeList(selectedList.id)}
                    />
                  ) : (
                    <PublicListDetail
                      list={selectedList}
                      groups={groups}
                      currentUser={currentUser}
                      commentCount={activeCommentCount}
                      newComment={newCommentByList[selectedList.id] ?? ""}
                      setNewComment={(value) => setNewCommentByList((current) => ({ ...current, [selectedList.id]: value }))}
                      onCommentSubmit={() => addComment(selectedList.id)}
                      isInFlight={isInFlight}
                      replyDrafts={replyDrafts}
                      setReplyDrafts={setReplyDrafts}
                      openReplyFor={openReplyFor}
                      setOpenReplyFor={setOpenReplyFor}
                      onReplySubmit={(commentId) => addComment(selectedList.id, commentId)}
                      onLike={() => toggleLike(selectedList)}
                    />
                  );
                })()}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
