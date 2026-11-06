import type { TutorBooking } from '@/api/tutor';
/** Shared synthetic data. Never use these values as production authorization. */
export const tutorSample = {
 now: '2027-03-20T05:00:00.000Z', startsAt: '2027-03-20T05:00:00.000Z', endsAt: '2027-03-20T05:10:00.000Z',
 bookingId: 'sample-booking', readyBookingId: 'sample-ready-booking', courseId: 'course-prompt-basics',
 courseTitle: 'Prompt Engineering Basics', learnerName: 'Olivia Kim', tenant: 'tenant-demo', learnerId: 'learner-demo',
 dateLabel: 'Saturday, 20 March 2027', timeLabel: '1:00 – 1:10 PM (SGT)',
};
export function createBookingFixture(overrides: Partial<TutorBooking> = {}): TutorBooking {
 return { id: tutorSample.bookingId, tenant: tutorSample.tenant, learnerId: tutorSample.learnerId, courseId: tutorSample.courseId, slotId: tutorSample.startsAt, month: tutorSample.startsAt.slice(0,7), startsAt: tutorSample.startsAt, endsAt: tutorSample.endsAt, status: 'BOOKED', createdAt: '2027-03-01T00:00:00.000Z', cancelledAt: null, ...overrides };
}
