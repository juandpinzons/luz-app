CREATE INDEX "conversation_messages_conversation_id_idx" ON "conversation_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journal_entries_user_id_idx" ON "journal_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habits_user_id_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "insights_user_id_idx" ON "insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "insights_status_idx" ON "insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "people_user_id_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entity_relations_from_idx" ON "entity_relations" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "entity_relations_to_idx" ON "entity_relations" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "evidence_insight_id_idx" ON "evidence" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_user_id_idx" ON "memory_embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_embeddings_source_idx" ON "memory_embeddings" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "knowledge_jobs_status_idx" ON "knowledge_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_jobs_user_id_idx" ON "knowledge_jobs" USING btree ("user_id");