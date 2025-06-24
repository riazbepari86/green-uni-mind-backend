"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityPriority = exports.ActivityType = void 0;
// Activity Types for Activity Feed
var ActivityType;
(function (ActivityType) {
    ActivityType["ENROLLMENT"] = "enrollment";
    ActivityType["COMPLETION"] = "completion";
    ActivityType["PAYMENT"] = "payment";
    ActivityType["REVIEW"] = "review";
    ActivityType["QUESTION"] = "question";
    ActivityType["COURSE_UPDATE"] = "course_update";
    ActivityType["CERTIFICATE"] = "certificate";
    ActivityType["REFUND"] = "refund";
    ActivityType["MESSAGE"] = "message";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var ActivityPriority;
(function (ActivityPriority) {
    ActivityPriority["LOW"] = "low";
    ActivityPriority["MEDIUM"] = "medium";
    ActivityPriority["HIGH"] = "high";
    ActivityPriority["URGENT"] = "urgent";
})(ActivityPriority || (exports.ActivityPriority = ActivityPriority = {}));
