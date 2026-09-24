-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "currentVenueId" TEXT;

-- AddForeignKey
ALTER TABLE "Volunteer" ADD CONSTRAINT "Volunteer_currentVenueId_fkey" FOREIGN KEY ("currentVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
