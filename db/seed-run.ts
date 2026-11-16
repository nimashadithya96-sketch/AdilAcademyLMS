import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { pool, requireDatabase } from "./client";
import {
  accountNumberSequence,
  courses,
  courseSections,
  lessons,
  users
} from "./schema";
import { initialCourse } from "./seed";

async function seed() {
  const db = requireDatabase();
  await db
    .insert(accountNumberSequence)
    .values({ id: 1, nextNumber: 527694 })
    .onConflictDoNothing();

  let [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, initialCourse.slug))
    .limit(1);
  if (!course) {
    [course] = await db
      .insert(courses)
      .values({
        slug: initialCourse.slug,
        title: initialCourse.title,
        shortDescription: initialCourse.shortDescription,
        description:
          "Crypto foundations සිට disciplined trading execution දක්වා සම්පූර්ණ Sinhala learning path එක.",
        price: "50000.00",
        points: 1,
        currency: initialCourse.currency,
        language: initialCourse.language,
        isPublished: true
      })
      .returning();

    for (let index = 0; index < initialCourse.modules.length; index += 1) {
      const [section] = await db
        .insert(courseSections)
        .values({
          courseId: course.id,
          title: initialCourse.modules[index],
          position: index + 1
        })
        .returning();
      await db.insert(lessons).values({
        sectionId: section.id,
        title: initialCourse.modules[index] + " — Introduction",
        content: "Lesson content is ready to be completed from the Admin panel.",
        durationSeconds: 0,
        position: 1,
        isPreview: index === 0
      });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);
    if (!existingAdmin) {
      await db.insert(users).values({
        email: adminEmail,
        passwordHash: await argon2.hash(adminPassword, {
          type: argon2.argon2id
        }),
        displayName: process.env.ADMIN_NAME?.trim() || "Super Admin",
        role: "admin",
        isActive: true,
        emailVerifiedAt: new Date(),
        passwordSetAt: new Date()
      });
    }
  }

  console.log("Adil Academy database seed completed.");
}

try {
  await seed();
} finally {
  await pool?.end();
}
