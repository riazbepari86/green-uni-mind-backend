import config from '../config';
import { USER_ROLE } from '../modules/User/user.constant';
import { User } from '../modules/User/user.model';

const superUser = {
  name: "Super Admin",
  email: 'admin@admin.com',
  password: config.super_admin_password,
  role: USER_ROLE.student,
  status: 'in-progress',
  isDeleted: false,
};

const seedSuperAdmin = async () => {
  // when database is connected, we will check if there any user who is super admin

  const isSuperAdminExists = await User.findOne({ role: USER_ROLE.student });

  if (!isSuperAdminExists) {
    await User.create(superUser);
  }
};

export default seedSuperAdmin;
