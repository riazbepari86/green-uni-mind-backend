import { Router } from 'express';
import { AIRoutes } from '../modules/AI/ai.route';
import { AnalyticsRoutes } from '../modules/Analytics/analytics.route';
import { AuthRoutes } from '../modules/Auth/auth.route';
import { OAuthRoutes } from '../modules/Auth/oauth.route';
import { OAuthCallbackRoutes } from '../modules/Auth/oauthCallback.route';
import { BookmarkRoutes } from '../modules/Bookmark/bookmark.route';
import { CategoryRoutes } from '../modules/Category/category.route';
import { CourseRoutes } from '../modules/Course/course.route';
import { InvoiceRoutes } from '../modules/Invoice/invoice.routes';
import { LectureRoutes } from '../modules/Lecture/lecture.route';
import { MessagingRoutes } from '../modules/Messaging/messaging.route';
import { NoteRoutes } from '../modules/Note/note.route';
import { PaymentRoutes } from '../modules/Payment/payment.route';
import { ReviewRoutes } from '../modules/Payment/review.route';
import { QuestionRoutes } from '../modules/Question/question.route';
import { StripeConnectRoutes } from '../modules/StripeConnect/stripeConnect.routes';
import { StudentRoutes } from '../modules/Student/student.route';
import { SubCategoryRoutes } from '../modules/SubCategory/subCategory.route';
import { TeacherRoutes } from '../modules/Teacher/teacher.route';
import { UserRoutes } from '../modules/User/user.route';
import apiValidationRoutes from './apiValidationRoutes';
import dashboardRoutes from './dashboardRoutes';
import databaseRoutes from './databaseRoutes';
import monitoringRoutes from './monitoringRoutes';

type TModuleRoutes = {
  path: string;
  route: Router;
};

const router = Router();

const moduleRoutes: TModuleRoutes[] = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/oauth',
    route: OAuthRoutes,
  },
  {
    path: '/oauth',
    route: OAuthCallbackRoutes,
  },
  {
    path: '/categories',
    route: CategoryRoutes,
  },
  {
    path: '/sub-category',
    route: SubCategoryRoutes,
  },
  {
    path: '/courses',
    route: CourseRoutes,
  },
  {
    path: '/lectures',
    route: LectureRoutes,
  },
  {
    path: '/payments',
    route: PaymentRoutes,
  },
  {
    path: '/invoices',
    route: InvoiceRoutes,
  },
  {
    path: '/stripe-connect',
    route: StripeConnectRoutes,
  },
  {
    path: '/students',
    route: StudentRoutes,
  },
  {
    path: '/teachers',
    route: TeacherRoutes,
  },
  {
    path: '/bookmarks',
    route: BookmarkRoutes,
  },
  {
    path: '/questions',
    route: QuestionRoutes,
  },
  {
    path: '/notes',
    route: NoteRoutes,
  },
  {
    path: '/ai',
    route: AIRoutes,
  },
  {
    path: '/analytics',
    route: AnalyticsRoutes,
  },
  {
    path: '/messaging',
    route: MessagingRoutes,
  },
  {
    path: '/reviews',
    route: ReviewRoutes,
  },
  {
    path: '/monitoring',
    route: monitoringRoutes,
  },
  {
    path: '/database',
    route: databaseRoutes,
  },
  {
    path: '/dashboard',
    route: dashboardRoutes,
  },
  {
    path: '/api-validation',
    route: apiValidationRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
