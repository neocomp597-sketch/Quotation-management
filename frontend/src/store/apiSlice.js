import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAccessToken, refreshAccessToken } from '../services/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4003/api'),
  credentials: 'include',
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithRefresh = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    try {
      await refreshAccessToken();
      result = await rawBaseQuery(args, api, extraOptions);
    } catch {
      // Let auth context own the final logout/redirect behavior.
    }
  }

  return result;
};

export const appApi = createApi({
  reducerPath: 'appApi',
  baseQuery: baseQueryWithRefresh,
  tagTypes: ['Auth', 'Quotation', 'QuotationDraft', 'Customer', 'Product'],
  endpoints: (builder) => ({
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
    getQuotations: builder.query({
      query: () => '/quotations',
      providesTags: ['Quotation'],
    }),
    getQuotationDraft: builder.query({
      query: (draftKey = 'new') => `/quotations/drafts/${draftKey}`,
      providesTags: ['QuotationDraft'],
    }),
    autosaveQuotationDraft: builder.mutation({
      query: ({ draftKey = 'new', payload }) => ({
        url: `/quotations/drafts/${draftKey}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: ['QuotationDraft'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetQuotationsQuery,
  useGetQuotationDraftQuery,
  useAutosaveQuotationDraftMutation,
} = appApi;
