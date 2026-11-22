// Where a ride is in its life, shared by the controllers and the socket.
// An open group lapses 5 min after its leaving time; once the cab is booked it stays live
// for up to 3 hours (the cab may be late, the trip takes time) or until the booker ends it.
const OPEN_GRACE_MS = 5 * 60_000;
const BOOKED_MS = 3 * 60 * 60_000;

const isLiveRide = (ride) =>
  !ride.endedAt && ride.time.getTime() > Date.now() - (ride.bookedAt ? BOOKED_MS : OPEN_GRACE_MS);

// open → booked → picked_up → ended; "past" if it lapsed without ending
const stageOf = (ride) => {
  if (ride.endedAt) return 'ended';
  if (!isLiveRide(ride)) return 'past';
  if (ride.pickedUpAt) return 'picked_up';
  return ride.bookedAt ? 'booked' : 'open';
};

// Prisma filter for the same thing
const liveRideWhere = () => ({
  endedAt: null,
  OR: [
    { time: { gt: new Date(Date.now() - OPEN_GRACE_MS) } },
    { bookedAt: { not: null }, time: { gt: new Date(Date.now() - BOOKED_MS) } },
  ],
});

module.exports = { isLiveRide, stageOf, liveRideWhere };
