"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_route_1 = require("../modules/User/user.route");
const auth_route_1 = require("../modules/Auth/auth.route");
const oauth_route_1 = require("../modules/Auth/oauth.route");
const oauthCallback_route_1 = require("../modules/Auth/oauthCallback.route");
const category_route_1 = require("../modules/Category/category.route");
const subCategory_route_1 = require("../modules/SubCategory/subCategory.route");
const course_route_1 = require("../modules/Course/course.route");
const lecture_route_1 = require("../modules/Lecture/lecture.route");
const payment_route_1 = require("../modules/Payment/payment.route");
const invoice_routes_1 = require("../modules/Invoice/invoice.routes");
const stripeConnect_routes_1 = require("../modules/StripeConnect/stripeConnect.routes");
const student_route_1 = require("../modules/Student/student.route");
const teacher_route_1 = require("../modules/Teacher/teacher.route");
const bookmark_route_1 = require("../modules/Bookmark/bookmark.route");
const question_route_1 = require("../modules/Question/question.route");
const note_route_1 = require("../modules/Note/note.route");
const ai_route_1 = require("../modules/AI/ai.route");
const analytics_route_1 = require("../modules/Analytics/analytics.route");
const messaging_route_1 = require("../modules/Messaging/messaging.route");
const review_route_1 = require("../modules/Payment/review.route");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/oauth',
        route: oauth_route_1.OAuthRoutes,
    },
    {
        path: '/oauth',
        route: oauthCallback_route_1.OAuthCallbackRoutes,
    },
    {
        path: '/categories',
        route: category_route_1.CategoryRoutes,
    },
    {
        path: '/sub-category',
        route: subCategory_route_1.SubCategoryRoutes,
    },
    {
        path: '/courses',
        route: course_route_1.CourseRoutes,
    },
    {
        path: '/lectures',
        route: lecture_route_1.LectureRoutes,
    },
    {
        path: '/payments',
        route: payment_route_1.PaymentRoutes,
    },
    {
        path: '/invoices',
        route: invoice_routes_1.InvoiceRoutes,
    },
    {
        path: '/stripe-connect',
        route: stripeConnect_routes_1.StripeConnectRoutes,
    },
    {
        path: '/students',
        route: student_route_1.StudentRoutes,
    },
    {
        path: '/teachers',
        route: teacher_route_1.TeacherRoutes,
    },
    {
        path: '/bookmarks',
        route: bookmark_route_1.BookmarkRoutes,
    },
    {
        path: '/questions',
        route: question_route_1.QuestionRoutes,
    },
    {
        path: '/notes',
        route: note_route_1.NoteRoutes,
    },
    {
        path: '/ai',
        route: ai_route_1.AIRoutes,
    },
    {
        path: '/analytics',
        route: analytics_route_1.AnalyticsRoutes,
    },
    {
        path: '/messaging',
        route: messaging_route_1.MessagingRoutes,
    },
    {
        path: '/reviews',
        route: review_route_1.ReviewRoutes,
    },
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
