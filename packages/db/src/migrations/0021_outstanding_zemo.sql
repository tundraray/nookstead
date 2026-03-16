ALTER TABLE "materials" ADD COLUMN "diggable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "fishable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "water_source" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "buildable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "surface_type" varchar(50);