"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Plus, MessageCircle, Film } from "lucide-react";
import { groups } from "@/data/mockData";
import { Button } from "@/components/ui/button";

export default function Groups() {
  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-bold text-foreground">
                Groups & Clubs
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Join communities, share watchlists, and discuss films together.
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Create Group
          </Button>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl bg-card p-6 card-shadow hover:card-shadow-hover transition-shadow duration-300"
            >
              <div className="flex items-start gap-4">
                <img
                  src={group.avatar}
                  alt={group.name}
                  className="h-14 w-14 rounded-xl bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{group.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {group.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {group.memberCount} members
                </span>
                <span className="flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" /> {group.sharedList.length} shared films
                </span>
              </div>

              {/* Member avatars */}
              <div className="flex items-center mt-4">
                <div className="flex -space-x-2">
                  {group.members.slice(0, 3).map((m) => (
                    <img
                      key={m.id}
                      src={m.avatar}
                      alt={m.displayName}
                      className="h-7 w-7 rounded-full border-2 border-card bg-muted"
                    />
                  ))}
                </div>
                {group.memberCount > 3 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    +{group.memberCount - 3} more
                  </span>
                )}
              </div>

              {/* Shared list preview */}
              <div className="flex gap-2 mt-4">
                {group.sharedList.slice(0, 3).map((movie) => (
                  <Link key={movie.id} href={`/movie/${movie.id}`}>
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="h-16 w-11 rounded object-cover poster-shadow hover:scale-105 transition-transform"
                    />
                  </Link>
                ))}
              </div>

              <div className="flex gap-2 mt-5">
                <Button size="sm" className="flex-1 gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Join
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> Discuss
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
