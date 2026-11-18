import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createSeedState, type DatabaseState } from './seed.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'maktab348.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let cachedState: DatabaseState | null = null;

export function getDb(): DatabaseState {
  if (cachedState) return cachedState;
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const loaded = JSON.parse(raw) as DatabaseState;
      let changed = false;

      // Backfill pdfUrl for any existing e-books and add missing grade e-books
      for (const book of loaded.ebooks) {
        if (!book.pdfUrl) {
          book.pdfUrl = `/api/ebooks/${book.id}/pdf`;
          changed = true;
        }
      }
      const seeded = createSeedState();
      const existingBookIds = new Set(loaded.ebooks.map((b) => b.id));
      for (const seedBook of seeded.ebooks) {
        if (!existingBookIds.has(seedBook.id)) {
          loaded.ebooks.push(seedBook);
          changed = true;
        }
      }

      // Backfill YouTube videoUrls on existing seeded lessons and add missing grade-level video lessons
      const seedVideoMap = new Map(seeded.videoLessons.map((v) => [v.id, v]));
      for (const vid of loaded.videoLessons) {
        const seedMatch = seedVideoMap.get(vid.id);
        if (seedMatch && !vid.videoUrl && seedMatch.videoUrl) {
          vid.videoUrl = seedMatch.videoUrl;
          vid.title = seedMatch.title;
          vid.topic = seedMatch.topic;
          vid.description = seedMatch.description;
          changed = true;
        }
      }
      const existingVideoIds = new Set(loaded.videoLessons.map((v) => v.id));
      for (const seedVid of seeded.videoLessons) {
        if (!existingVideoIds.has(seedVid.id)) {
          loaded.videoLessons.push(seedVid);
          changed = true;
        }
      }

      // Backfill helpVideoUrl on seeded homeworks
      const seedHwMap = new Map(seeded.homeworks.map((h) => [h.id, h]));
      for (const hw of loaded.homeworks) {
        const seedMatch = seedHwMap.get(hw.id);
        if (seedMatch && !hw.helpVideoUrl && seedMatch.helpVideoUrl) {
          hw.helpVideoUrl = seedMatch.helpVideoUrl;
          changed = true;
        }
      }

      // Backfill language course YouTube URLs if missing
      const seedCourseMap = new Map(seeded.languageCourses.map((c) => [c.id, c]));
      for (const course of loaded.languageCourses) {
        const seedCourse = seedCourseMap.get(course.id);
        if (!seedCourse) continue;
        for (const lvl of course.levels) {
          const seedLvl = seedCourse.levels.find((l) => l.level === lvl.level);
          if (seedLvl && !lvl.videoUrl && seedLvl.videoUrl) {
            lvl.videoUrl = seedLvl.videoUrl;
            changed = true;
          }
        }
      }

      cachedState = loaded;
      if (changed) saveDb(cachedState);
      return cachedState;
    } catch {
      // Corrupt or incomplete file fallback to fresh seed
    }
  }
  cachedState = createSeedState();
  saveDb(cachedState);
  return cachedState;
}

export function saveDb(nextState?: DatabaseState): void {
  ensureDirs();
  const state = nextState || cachedState;
  if (!state) return;
  cachedState = state;
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function saveUploadedFile(params: {
  filename: string;
  mimeType: string;
  base64Data: string;
}): { fileId: string; url: string; safeName: string } {
  ensureDirs();
  const cleanBase64 = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;
  const buffer = Buffer.from(cleanBase64, 'base64');
  const maxBytes = 15 * 1024 * 1024; // 15MB cap
  if (buffer.length > maxBytes) {
    throw new Error('Fayl hajmi 15 MB dan oshmasligi kerak');
  }
  const ext = path.extname(params.filename).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
  const fileId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const metaPath = path.join(UPLOADS_DIR, `${fileId}.meta.json`);
  const binPath = path.join(UPLOADS_DIR, fileId);
  fs.writeFileSync(binPath, buffer);
  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      originalName: params.filename,
      mimeType: params.mimeType || 'application/octet-stream',
      size: buffer.length,
    }),
    'utf8'
  );
  return {
    fileId,
    url: `/api/files/${fileId}`,
    safeName: params.filename,
  };
}

export function readUploadedFile(fileId: string): { buffer: Buffer; mimeType: string; originalName: string } | null {
  const safeId = path.basename(fileId);
  const binPath = path.join(UPLOADS_DIR, safeId);
  const metaPath = path.join(UPLOADS_DIR, `${safeId}.meta.json`);
  if (!fs.existsSync(binPath) || !fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { mimeType: string; originalName: string };
  return {
    buffer: fs.readFileSync(binPath),
    mimeType: meta.mimeType,
    originalName: meta.originalName,
  };
}
