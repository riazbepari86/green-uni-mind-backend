"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationType = exports.MessageType = exports.MessageStatus = void 0;
// Message Status Enum
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
// Message Type Enum
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["FILE"] = "file";
    MessageType["IMAGE"] = "image";
    MessageType["VIDEO"] = "video";
    MessageType["AUDIO"] = "audio";
    MessageType["DOCUMENT"] = "document";
})(MessageType || (exports.MessageType = MessageType = {}));
// Conversation Type Enum
var ConversationType;
(function (ConversationType) {
    ConversationType["STUDENT_TEACHER"] = "student_teacher";
    ConversationType["GROUP"] = "group";
    ConversationType["ANNOUNCEMENT"] = "announcement";
})(ConversationType || (exports.ConversationType = ConversationType = {}));
