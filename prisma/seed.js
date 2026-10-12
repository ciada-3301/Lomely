const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Lomely database...");

  // Check if admin user exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("adminpassword123", 12);
    adminUser = await prisma.user.create({
      data: {
        username: "admin",
        email: "admin@lomely.app",
        passwordHash,
        isEmailVerified: true,
        role: "ADMIN",
        status: "ONLINE",
        bio: "Lomely System Administrator",
      },
    });
    console.log("Created admin user: @admin (email: admin@lomely.app / pass: adminpassword123)");
  }

  // Create demo member
  const existingAlex = await prisma.user.findUnique({
    where: { username: "alexander" },
  });

  let alexUser = existingAlex;
  if (!existingAlex) {
    const passwordHash = await bcrypt.hash("alexander123", 12);
    alexUser = await prisma.user.create({
      data: {
        username: "alexander",
        email: "alex@lomely.app",
        passwordHash,
        isEmailVerified: true,
        role: "USER",
        status: "ONLINE",
        bio: "Music curator and cinema enthusiast.",
      },
    });
    console.log("Created demo user: @alexander");
  }

  // Create initial public featured room
  const existingRoom = await prisma.room.findUnique({
    where: { code: "lml-cyber" },
  });

  if (!existingRoom && adminUser) {
    const room = await prisma.room.create({
      data: {
        code: "lml-cyber",
        name: "Synthwave & Cyber Ambient",
        description: "Late night synchronized music streams and voice hangout.",
        isPublic: true,
        hostId: adminUser.id,
        currentMediaUrl: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
        currentMediaTitle: "Lofi Hip Hop Radio &bull; Beats to Relax/Study to",
        mediaState: "PLAYING",
        participants: {
          create: [
            { userId: adminUser.id, role: "HOST" },
            ...(alexUser ? [{ userId: alexUser.id, role: "MEMBER" }] : []),
          ],
        },
        messages: {
          create: [
            {
              senderId: adminUser.id,
              content: "Welcome to the Lomely stage! Audio and video are synchronized.",
            },
            ...(alexUser
              ? [
                  {
                    senderId: alexUser.id,
                    content: "The low latency sync is working perfectly.",
                  },
                ]
              : []),
          ],
        },
      },
    });
    console.log(`Created sample room: ${room.name} (${room.code})`);
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
