CREATE INDEX "knowledge_engine_evidence_memory_id_idx" ON "knowledge_engine_evidence" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "life_goals_life_graph_id_status_idx" ON "life_goals" USING btree ("life_graph_id","status");--> statement-breakpoint
CREATE INDEX "life_habits_life_graph_id_active_idx" ON "life_habits" USING btree ("life_graph_id","active");--> statement-breakpoint
CREATE INDEX "life_projects_life_graph_id_status_idx" ON "life_projects" USING btree ("life_graph_id","status");--> statement-breakpoint
CREATE INDEX "concept_evidence_insight_id_idx" ON "concept_evidence" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "belief_evidence_insight_id_idx" ON "belief_evidence" USING btree ("insight_id");