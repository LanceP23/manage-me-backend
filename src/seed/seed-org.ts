import 'tsconfig-paths/register';
import * as dotenv from 'dotenv';
import { dataSource } from '../data-source';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationMember } from '../organization/entities/organization-member.entity';

if (process.env.NO_DOTENV !== 'true') {
  dotenv.config();
}

const getEnv = (key: string, fallback?: string) => {
  const value = process.env[key];
  if (value && value.trim()) {
    return value.trim();
  }
  return fallback;
};

const seedAdminEmail = getEnv('SEED_ADMIN_EMAIL', 'admin@example.com') as string;
const seedAdminPassword = getEnv('SEED_ADMIN_PASSWORD', 'password123') as string;
const seedFirstName = getEnv('SEED_ADMIN_FIRST_NAME', 'Admin') as string;
const seedLastName = getEnv('SEED_ADMIN_LAST_NAME', 'User') as string;
const seedOrgName = getEnv('SEED_ORG_NAME', 'Default Org') as string;
const seedOrgSlug = getEnv('SEED_ORG_SLUG', 'default-org') as string;
const seedSpecialists = getEnv('SEED_SPECIALISTS', 'true') === 'true';

const specialistUsers = [
  {
    firstName: 'Bea',
    lastName: 'Backend',
    email: 'backend@example.com',
    password: 'password123',
    role: 'member',
  },
  {
    firstName: 'Fiona',
    lastName: 'Frontend',
    email: 'frontend@example.com',
    password: 'password123',
    role: 'member',
  },
  {
    firstName: 'Mika',
    lastName: 'Mobile',
    email: 'mobile@example.com',
    password: 'password123',
    role: 'member',
  },
] as const;

const start = async () => {
  await dataSource.initialize();

  try {
    const userRepo = dataSource.getRepository(User);
    const orgRepo = dataSource.getRepository(Organization);
    const memberRepo = dataSource.getRepository(OrganizationMember);

    let user = await userRepo.findOne({ where: { email: seedAdminEmail } });
    if (!user) {
      user = userRepo.create({
        firstName: seedFirstName,
        lastName: seedLastName,
        email: seedAdminEmail,
        password: seedAdminPassword,
        isActive: true,
      });
      user = await userRepo.save(user);
    }

    let organization = await orgRepo.findOne({ where: { slug: seedOrgSlug } });
    if (!organization) {
      organization = orgRepo.create({
        name: seedOrgName,
        slug: seedOrgSlug,
        isActive: true,
      });
      organization = await orgRepo.save(organization);
    }

    const existingMember = await memberRepo.findOne({
      where: {
        organization: { id: organization.id },
        user: { id: user.id },
      },
      relations: ['organization', 'user'],
    });

    if (!existingMember) {
      const member = memberRepo.create({
        organization,
        user,
        role: 'owner',
      });
      await memberRepo.save(member);
    }

    if (seedSpecialists) {
      for (const specialist of specialistUsers) {
        let specialistUser = await userRepo.findOne({
          where: { email: specialist.email },
        });

        if (!specialistUser) {
          specialistUser = userRepo.create({
            firstName: specialist.firstName,
            lastName: specialist.lastName,
            email: specialist.email,
            password: specialist.password,
            isActive: true,
          });
          specialistUser = await userRepo.save(specialistUser);
        }

        const existingSpecialistMember = await memberRepo.findOne({
          where: {
            organization: { id: organization.id },
            user: { id: specialistUser.id },
          },
          relations: ['organization', 'user'],
        });

        if (!existingSpecialistMember) {
          const member = memberRepo.create({
            organization,
            user: specialistUser,
            role: specialist.role,
          });
          await memberRepo.save(member);
        }
      }
    }

    console.log('Seed complete');
    console.log(`Admin email: ${seedAdminEmail}`);
    console.log(`Org slug: ${seedOrgSlug}`);
    if (seedSpecialists) {
      console.log('Specialists: backend@example.com, frontend@example.com, mobile@example.com');
    }
  } finally {
    await dataSource.destroy();
  }
};

start().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
