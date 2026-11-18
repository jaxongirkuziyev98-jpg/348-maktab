export type Lang = 'uz' | 'ru' | 'en';
export type UserRole = 'student' | 'teacher' | 'admin';

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  avatarUrl?: string;
  parentPhone?: string;
  grade?: number; // 1-11 for students
  assignedGrades?: number[]; // for teachers
  assignedSubjectIds?: string[]; // for teachers
  approved: boolean;
  stars: number; // gamification for grades 1-4
  medals: string[];
  streakDays: number;
  subscriptionStatus: 'active' | 'expired';
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface SubjectTopic {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  videoUrl?: string;
  ebookTitle?: string;
  ebookUrl?: string;
  keyPoints: string[];
}

export interface Subject {
  id: string;
  code: string;
  name: LocalizedText;
  description: LocalizedText;
  gradeMin: number;
  gradeMax: number;
  accentColor: string;
  topics: SubjectTopic[];
}

export interface VideoLesson {
  id: string;
  subjectId: string;
  grade: number;
  title: string;
  topic: string;
  description: string;
  durationMinutes: number;
  videoUrl?: string; // Real uploaded video (/api/files/...) or official link added by admin/teacher
  lessonSlides: string[];
  createdBy: string;
  createdAt: string;
}

export interface Ebook {
  id: string;
  subjectId: string;
  grade: number;
  title: string;
  author: string;
  pagesCount: number;
  description: string;
  pdfUrl?: string; // Uploaded PDF or downloadable generated study guide
  previewText: string;
  createdBy: string;
  createdAt: string;
}

export type HomeworkStatus = 'active' | 'cancelled';
export type SubmissionStatus = 'pending' | 'approved' | 'revision_needed';

export interface Homework {
  id: string;
  title: string;
  subjectId: string;
  grade: number;
  topic: string;
  dueDate: string; // ISO string
  description: string;
  helpVideoUrl?: string;
  helpPdfUrl?: string;
  helpPdfName?: string;
  helpImageUrl?: string;
  helpExplanation: string;
  status: HomeworkStatus;
  createdBy: string;
  createdAt: string;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  textAnswer: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  status: SubmissionStatus;
  gradeScore: number | null; // 1-5 or 0-100
  teacherComment?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface TestQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface TestItem {
  id: string;
  title: string;
  subjectId?: string;
  languageCourseId?: string;
  languageLevel?: LanguageLevel;
  grade?: number;
  durationMinutes: number;
  questions: TestQuestion[]; // Strictly 20 questions
  createdBy: string;
  createdAt: string;
}

export interface TestAnswerDetail {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  answers: number[];
  correctCount: number;
  wrongCount: number;
  scorePercent: number;
  totalPoints: number;
  details: TestAnswerDetail[];
  completedAt: string;
}

export type LanguageLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface VocabularyWord {
  id: string;
  word: string;
  transcription: string;
  translationUz: string;
  translationRu: string;
  example: string;
}

export interface LanguageLevelModule {
  level: LanguageLevel;
  videoTitle: string;
  videoUrl?: string;
  grammarTitle: string;
  grammarNotes: string[];
  vocabulary: VocabularyWord[];
  listeningScript: string;
  listeningQuestion: string;
  listeningOptions: string[];
  listeningCorrectIndex: number;
  speakingPrompt: string;
  speakingSample: string;
  readingTitle: string;
  readingPassage: string;
  readingQuestion: string;
  homeworkPrompt: string;
}

export interface LanguageCourse {
  id: string;
  slug: string;
  name: LocalizedText;
  nativeName: string;
  speechLang: string;
  levels: LanguageLevelModule[];
}

export interface LanguageProgress {
  id: string;
  studentId: string;
  courseId: string;
  level: LanguageLevel;
  completedSections: string[]; // 'video' | 'grammar' | 'vocab' | 'listening' | 'speaking' | 'reading' | 'homework'
  learnedWordIds: string[];
  homeworkAnswer?: string;
  updatedAt: string;
}

export interface SmsLog {
  id: string;
  homeworkId?: string;
  studentId?: string;
  recipientType: 'student' | 'parent' | 'otp';
  phone: string;
  message: string;
  status: 'sent' | 'demo_logged' | 'failed';
  mode: 'gateway' | 'demo';
  sentAt: string;
}

export type PaymentProviderApp = 'click' | 'payme' | 'uzum' | 'paynet' | 'anorbank' | 'oson';

export interface PaymentRecord {
  id: string;
  userId: string;
  amountUzs: number;
  provider: PaymentProviderApp;
  targetCard?: string;
  mode: 'live' | 'demo';
  status: 'pending' | 'completed' | 'failed';
  merchantTransId: string;
  clickTransId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'homework' | 'grade' | 'test' | 'subscription' | 'sms' | 'system';
  read: boolean;
  createdAt: string;
}

export interface SchoolClass {
  id: string;
  grade: number;
  section: string; // e.g. 'A', 'B'
  roomNumber: string;
  homeroomTeacherId?: string;
}

export interface IntegrationStatus {
  sms: {
    configured: boolean;
    mode: 'gateway' | 'demo';
    providerLabel: string;
  };
  click: {
    configured: boolean;
    mode: 'live' | 'demo';
    priceUzs: number;
    durationDays: number;
  };
}
