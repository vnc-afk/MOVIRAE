"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ListPlus,
  Plus,
  Users,
  Lock,
  Globe,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Film,
  Check,
  X,
  Sparkles,
  Search,
  MessageSquareReply,
  Send,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoviePrefetchLink } from "@/components/MoviePrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Group, Movie, SharedList, UserProfile } from "@/lib/types";

const visibilityConfig = {
  public: { icon: Globe, label: "Public", color: "text-green-500" },
  private: { icon: Lock, label: "Private", color: "text-amber-500" },
  group: { icon: Users, label: "Group", color: "text-blue-500" },
};

type SharedListComment = NonNullable<SharedList["commentItems"]>[number];

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

function formatRelativeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const distance = formatDistanceToNowStrict(parsed, { addSuffix: true });
  return distance === "0 seconds ago" ? "Just now" : distance;
}

function formatExactDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "PPpp");
}

function getSafeImageSrc(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

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
              <h1 className="font-display text-2xl font-bold text-foreground">
                Shared Lists
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Co-create watchlists with friends, groups, or the community.
            </p>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Shared List
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Shared List</DialogTitle>
                <DialogDescription>
                  Create a public, private, or group movie list that others can explore and discuss.
                </DialogDescription>
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
                  <Button onClick={createList}><Check className="h-4 w-4 mr-1" /> Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="all" className="gap-1.5 text-xs">
              <Globe className="h-3 w-3" /> All
            </TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5 text-xs">
              <Film className="h-3 w-3" /> My Lists
            </TabsTrigger>
            <TabsTrigger value="collaborating" className="gap-1.5 text-xs">
              <Users className="h-3 w-3" /> Collaborating
            </TabsTrigger>
            <TabsTrigger value="group" className="gap-1.5 text-xs">
              <Users className="h-3 w-3" /> Group Lists
            </TabsTrigger>
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
                        />
                      ) : (
                        <PublicListCard
                          key={list.id}
                          list={list}
                          index={i}
                          isInFlight={isInFlight}
                          onLike={toggleLike}
                          onOpen={setSelectedListId}
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
                  <DialogDescription>
                    {(() => {
                      const isOwner = currentUser?.id === selectedList.owner.id;
                      const isCollaborator = currentUser ? selectedList.collaborators.some((c) => c.id === currentUser.id) : false;
                      const canEdit = isOwner || isCollaborator;
                      return canEdit ? "View this shared list, discuss it, and add more movies." : "View this shared list and discuss it.";
                    })()}
                  </DialogDescription>
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

function ListCard({ list, index, currentUser, isInFlight, onLike, onDelete, onOpen }: { list: SharedList; index: number; currentUser: UserProfile | null; isInFlight: (opId: string) => boolean; onLike: (list: SharedList) => void; onDelete: (id: string) => void; onOpen: (id: string) => void; }) {
  const vis = visibilityConfig[list.visibility];
  const VisIcon = vis.icon;
  const isOwner = currentUser?.id === list.owner.id;
  const isCollaborator = currentUser ? list.collaborators.some((c) => c.id === currentUser.id) : false;
  const canEdit = isOwner || isCollaborator;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-all duration-300 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{list.name}</h3>
            <Badge variant="outline" className={`text-[10px] gap-1 ${vis.color}`}>
              <VisIcon className="h-2.5 w-2.5" /> {vis.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
        </div>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Invite Collaborator</DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onOpen(list.id)}><Film className="h-3.5 w-3.5" /> Add Movie</DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDelete(list.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete List
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Movie posters strip */}
      <div className="flex gap-2 mt-4 overflow-hidden">
        {list.movies.slice(0, 5).map((movie) => (
          <MoviePrefetchLink key={movie.id} movieId={movie.id} href={`/movie/${movie.id}`} className="flex-1 min-w-0">
            <img
              src={getSafeImageSrc(movie.poster) || ""}
              alt={movie.title}
              className="h-20 w-full rounded-md object-cover poster-shadow hover:scale-105 transition-transform duration-200"
            />
          </MoviePrefetchLink>
        ))}
        {list.movies.length > 5 && (
          <div className="flex-1 min-w-0 h-20 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{list.movies.length - 5}
          </div>
        )}
      </div>

      {/* Owner & collaborators */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
            <AvatarFallback>{list.owner.displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{list.owner.displayName}</span>
          {list.collaborators.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">+</span>
              <div className="flex -space-x-1.5">
                {list.collaborators.slice(0, 3).map((c) => (
                  <Avatar key={c.id} className="h-5 w-5 border border-card">
                    <AvatarImage src={getSafeImageSrc(c.avatar)} />
                    <AvatarFallback className="text-[8px]">{c.displayName[0]}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">{formatRelativeDate(list.createdAt)}</span>
      </div>

      {/* Stats & actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {list.movies.length} films</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {list.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {list.comments}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 hover:text-primary"
            onClick={() => onLike(list)}
            disabled={isInFlight(`shared-list-like-${list.id}`)}
          >
            {isInFlight(`shared-list-like-${list.id}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={`h-3 w-3 ${list.likedByMe ? "fill-primary text-primary" : ""}`} />} {list.likedByMe ? "Liked" : "Like"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onOpen(list.id)}
          >
            View
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function PublicListCard({ list, index, isInFlight, onLike, onOpen }: { list: SharedList; index: number; isInFlight: (opId: string) => boolean; onLike: (list: SharedList) => void; onOpen: (id: string) => void; }) {
  const vis = visibilityConfig[list.visibility];
  const VisIcon = vis.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl bg-card p-5 card-shadow hover:card-shadow-hover transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{list.name}</h3>
            <Badge variant="outline" className={`text-[10px] gap-1 ${vis.color}`}>
              <VisIcon className="h-2.5 w-2.5" /> {vis.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{list.description}</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4 overflow-hidden">
        {list.movies.slice(0, 5).map((movie) => (
          <MoviePrefetchLink key={movie.id} movieId={movie.id} href={`/movie/${movie.id}`} className="flex-1 min-w-0">
            <img
              src={getSafeImageSrc(movie.poster) || ""}
              alt={movie.title}
              className="h-20 w-full rounded-md object-cover poster-shadow hover:scale-105 transition-transform duration-200"
            />
          </MoviePrefetchLink>
        ))}
        {list.movies.length > 5 && (
          <div className="flex-1 min-w-0 h-20 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{list.movies.length - 5}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
            <AvatarFallback>{list.owner.displayName[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{list.owner.displayName}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{formatRelativeDate(list.createdAt)}</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {list.movies.length} films</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {list.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {list.comments}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 hover:text-primary"
            onClick={() => onLike(list)}
            disabled={isInFlight(`shared-list-like-${list.id}`)}
          >
            {isInFlight(`shared-list-like-${list.id}`) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={`h-3 w-3 ${list.likedByMe ? "fill-primary text-primary" : ""}`} />} {list.likedByMe ? "Liked" : "Like"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onOpen(list.id)}
          >
            View
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ListDetail({
  list,
  groups,
  currentUser,
  commentCount,
  newComment,
  setNewComment,
  onCommentSubmit,
  isInFlight,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  onReplySubmit,
  movieSearchQuery,
  setMovieSearchQuery,
  movieSearchResults,
  movieSearchLoading,
  movieSearchError,
  onAddMovie,
  addingMovieToListId,
  removingMovieFromListId,
  onRemoveMovie,
  onLike,
  onDelete,
}: {
  list: SharedList;
  groups: Group[];
  currentUser: UserProfile | null;
  commentCount: number;
  newComment: string;
  setNewComment: (value: string) => void;
  onCommentSubmit: () => void;
  isInFlight: (opId: string) => boolean;
  replyDrafts: Record<string, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  onReplySubmit: (commentId: string) => void;
  movieSearchQuery: string;
  setMovieSearchQuery: (value: string) => void;
  movieSearchResults: Movie[];
  movieSearchLoading: boolean;
  movieSearchError: string | null;
  onAddMovie: (listId: string, movieId: string) => void;
  addingMovieToListId: string | null;
  removingMovieFromListId: string | null;
  onRemoveMovie: (listId: string, movieId: string) => void;
  onLike: () => void;
  onDelete: () => void;
}) {
  const config = visibilityConfig[list.visibility];
  const VisibilityIcon = config.icon;
  const group = list.groupId ? groups.find((item) => item.id === list.groupId) : null;
  const commentItems = list.commentItems ?? [];
  const isOwner = currentUser?.id === list.owner.id;
  const isCollaborator = currentUser ? list.collaborators.some((collaborator) => collaborator.id === currentUser.id) : false;
  const canEdit = isOwner || isCollaborator;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <VisibilityIcon className={`h-3.5 w-3.5 ${config.color}`} />
              {config.label}
              {group && <Badge variant="outline">{group.name}</Badge>}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{list.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{list.description}</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onLike} className="gap-2">
              <Heart className={`h-4 w-4 ${list.likedByMe ? "fill-primary text-primary" : ""}`} />
              {list.likes}
            </Button>
            {isOwner && (
              <Button variant="destructive" size="sm" onClick={onDelete} className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
            <AvatarFallback>{list.owner.displayName.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">by {list.owner.displayName}</p>
            <p className="text-xs text-muted-foreground" title={formatExactDate(list.createdAt)}>{formatRelativeDate(list.createdAt)}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {list.collaborators.length + 1} members
            <span className="hidden sm:inline">•</span>
            <MessageCircle className="h-3.5 w-3.5" /> {commentCount} replies
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Film className="h-4 w-4" /> Movies
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.movies.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No movies yet. Use the add movie search on the right.
            </div>
          ) : (
            list.movies.map((movie) => (
              <div key={movie.id} className="relative group rounded-lg overflow-hidden border border-border bg-card">
                <MoviePrefetchLink movieId={movie.id} href={`/movie/${movie.id}`} className="block">
                  {getSafeImageSrc(movie.poster) ? (
                    <img
                      src={getSafeImageSrc(movie.poster)}
                      alt={movie.title}
                      className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">Open movie page</p>
                  </div>
                </MoviePrefetchLink>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemoveMovie(list.id, movie.id);
                    }}
                    disabled={removingMovieFromListId === list.id}
                    className="absolute right-3 top-3 z-10 rounded-full border border-border bg-background/90 p-1 text-destructive shadow hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareReply className="h-4 w-4" /> Comments
          </div>

          <div className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              placeholder={currentUser ? "Write a comment to start the conversation" : "Sign in to comment"}
              rows={3}
            />
            <div className="flex justify-end">
              <Button onClick={onCommentSubmit} className="gap-2" disabled={!currentUser || isInFlight(`shared-list-comment-${list.id}`)}>
                {isInFlight(`shared-list-comment-${list.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post comment
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {commentItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No comments yet.
              </div>
            )}

            {commentItems.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                replyDrafts={replyDrafts}
                setReplyDrafts={setReplyDrafts}
                openReplyFor={openReplyFor}
                setOpenReplyFor={setOpenReplyFor}
                onReplySubmit={onReplySubmit}
                isInFlight={isInFlight}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Plus className="h-4 w-4" /> Add movie
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Search TMDb and add a movie straight to this list.</p>
        </div>

        {canEdit ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={movieSearchQuery}
                onChange={(event) => setMovieSearchQuery(event.target.value)}
                placeholder="Search for a movie"
                className="pl-9"
              />
            </div>

            {movieSearchLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching TMDb...
              </div>
            )}

            {movieSearchError && <p className="text-xs text-destructive">{movieSearchError}</p>}

            <div className="space-y-2">
              {movieSearchResults.map((movie) => (
                <div key={movie.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  {getSafeImageSrc(movie.poster) ? (
                    <img src={getSafeImageSrc(movie.poster)} alt={movie.title} className="h-16 w-12 rounded object-cover bg-muted" />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Film className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">{movie.year} • {movie.genre}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddMovie(list.id, movie.id)}
                    disabled={addingMovieToListId === list.id}
                  >
                    {addingMovieToListId === list.id ? "Adding..." : "Add"}
                  </Button>
                </div>
              ))}

              {!movieSearchLoading && movieSearchQuery.trim().length >= 2 && movieSearchResults.length === 0 && !movieSearchError && (
                <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                  No movie matches found.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            Only the list owner or collaborators can add and remove movies from this list.
          </div>
        )}
      </div>
    </div>
  );
}

function PublicListDetail({
  list,
  groups,
  currentUser,
  commentCount,
  newComment,
  setNewComment,
  onCommentSubmit,
  isInFlight,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  onReplySubmit,
  onLike,
}: {
  list: SharedList;
  groups: Group[];
  currentUser: UserProfile | null;
  commentCount: number;
  newComment: string;
  setNewComment: (value: string) => void;
  onCommentSubmit: () => void;
  isInFlight: (opId: string) => boolean;
  replyDrafts: Record<string, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  onReplySubmit: (commentId: string) => void;
  onLike: () => void;
}) {
  const config = visibilityConfig[list.visibility];
  const VisibilityIcon = config.icon;
  const group = list.groupId ? groups.find((item) => item.id === list.groupId) : null;
  const commentItems = list.commentItems ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <VisibilityIcon className={`h-3.5 w-3.5 ${config.color}`} />
            {config.label}
            {group && <Badge variant="outline">{group.name}</Badge>}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">{list.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{list.description}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onLike} className="gap-2" disabled={isInFlight(`shared-list-like-${list.id}`)}>
            {isInFlight(`shared-list-like-${list.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${list.likedByMe ? "fill-primary text-primary" : ""}`} />}
            {list.likes}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={getSafeImageSrc(list.owner.avatar)} />
          <AvatarFallback>{list.owner.displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">by {list.owner.displayName}</p>
          <p className="text-xs text-muted-foreground" title={formatExactDate(list.createdAt)}>{formatRelativeDate(list.createdAt)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {list.collaborators.length + 1} members
          <span className="hidden sm:inline">•</span>
          <MessageCircle className="h-3.5 w-3.5" /> {commentCount} replies
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Film className="h-4 w-4" /> Movies
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.movies.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No movies in this list yet.
            </div>
          ) : (
            list.movies.map((movie) => (
              <div key={movie.id} className="relative group rounded-lg overflow-hidden border border-border bg-card">
                <MoviePrefetchLink movieId={movie.id} href={`/movie/${movie.id}`} className="block">
                  {getSafeImageSrc(movie.poster) ? (
                    <img
                      src={getSafeImageSrc(movie.poster)}
                      alt={movie.title}
                      className="h-40 w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{movie.title}</p>
                    <p className="text-xs text-muted-foreground">Open movie page</p>
                  </div>
                </MoviePrefetchLink>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageSquareReply className="h-4 w-4" /> Comments
        </div>

        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            placeholder={currentUser ? "Write a comment to start the conversation" : "Sign in to comment"}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={onCommentSubmit} className="gap-2" disabled={!currentUser || isInFlight(`shared-list-comment-${list.id}`)}>
              {isInFlight(`shared-list-comment-${list.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post comment
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {commentItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No comments yet.
            </div>
          )}

          {commentItems.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              openReplyFor={openReplyFor}
              setOpenReplyFor={setOpenReplyFor}
              onReplySubmit={onReplySubmit}
              isInFlight={isInFlight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentNode({
  comment,
  replyDrafts,
  setReplyDrafts,
  openReplyFor,
  setOpenReplyFor,
  onReplySubmit,
  isInFlight,
}: {
  comment: SharedListComment;
  replyDrafts: Record<string, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openReplyFor: string | null;
  setOpenReplyFor: (value: string | null) => void;
  onReplySubmit: (commentId: string) => void;
  isInFlight: (opId: string) => boolean;
}) {
  const isReplying = openReplyFor === comment.id;
  const isReplySubmitting = isInFlight(`shared-list-reply-${comment.id}`);

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={getSafeImageSrc(comment.user.avatar)} />
          <AvatarFallback>{comment.user.displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-foreground">{comment.user.displayName}</span>
            <span className="text-muted-foreground" title={formatExactDate(comment.date)}>{formatRelativeDate(comment.date)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{comment.body}</p>

          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="text-foreground hover:text-primary" onClick={() => setOpenReplyFor(isReplying ? null : comment.id)}>
              Reply
            </button>
          </div>

          {isReplying && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyDrafts[comment.id] ?? ""}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                placeholder="Write a reply"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpenReplyFor(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => onReplySubmit(comment.id)} disabled={isReplySubmitting}>
                  {isReplySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post reply
                </Button>
              </div>
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l border-border pl-3">
              {comment.replies.map((reply) => (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  replyDrafts={replyDrafts}
                  setReplyDrafts={setReplyDrafts}
                  openReplyFor={openReplyFor}
                  setOpenReplyFor={setOpenReplyFor}
                  onReplySubmit={onReplySubmit}
                  isInFlight={isInFlight}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
