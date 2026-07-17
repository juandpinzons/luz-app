ALTER TABLE "memory_embeddings" DROP CONSTRAINT "memory_embeddings_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX "memory_embeddings_user_id_idx";--> statement-breakpoint
ALTER TABLE "memory_embeddings" RENAME COLUMN "user_id" TO "life_graph_id";--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_life_graph_id_life_graphs_id_fk" FOREIGN KEY ("life_graph_id") REFERENCES "public"."life_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_embeddings_life_graph_id_idx" ON "memory_embeddings" USING btree ("life_graph_id");
