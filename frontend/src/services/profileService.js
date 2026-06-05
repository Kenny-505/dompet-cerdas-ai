import api from './api';

export const profileService = {
  /** GET /users/profile */
  get: async () => {
    const res = await api.get('/users/profile');
    return res.data.data;
  },

  /** PUT /users/profile */
  update: async (payload) => {
    const res = await api.put('/users/profile', payload);
    return res.data.data;
  },

  /** PUT /users/change-password */
  changePassword: async (payload) => {
    const res = await api.put('/users/change-password', payload);
    return res.data;
  },
};
