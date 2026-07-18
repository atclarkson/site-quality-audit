import { redirect } from 'next/navigation';
import { getAuthorizedAppContext } from './authorized-app-context';
import {
  createSiteForWorkspace,
  deleteSiteForWorkspace,
  siteValuesFromFormData,
  toSiteFormErrorState,
  updateSiteForWorkspace,
  type SiteFormState,
} from './site-management';

type RedirectFn = (path: string) => never;

export const createCreateSiteAction = ({
  createSiteForWorkspaceImpl = createSiteForWorkspace,
  getAuthorizedAppContextImpl = getAuthorizedAppContext,
  redirectImpl = redirect,
}: {
  createSiteForWorkspaceImpl?: typeof createSiteForWorkspace;
  getAuthorizedAppContextImpl?: typeof getAuthorizedAppContext;
  redirectImpl?: RedirectFn;
} = {}) => {
  return async (
    _previousState: SiteFormState,
    formData: FormData,
  ): Promise<SiteFormState> => {
    'use server';

    const context = await getAuthorizedAppContextImpl();

    if (!context) {
      return redirectImpl('/');
    }

    const values = siteValuesFromFormData(formData);

    let site;

    try {
      site = await createSiteForWorkspaceImpl(context, values);
    } catch (error) {
      return toSiteFormErrorState(error, values);
    }

    return redirectImpl(`/app/sites/${site.id}`);
  };
};

export const createUpdateSiteAction = (
  siteId: string,
  {
    getAuthorizedAppContextImpl = getAuthorizedAppContext,
    redirectImpl = redirect,
    updateSiteForWorkspaceImpl = updateSiteForWorkspace,
  }: {
    getAuthorizedAppContextImpl?: typeof getAuthorizedAppContext;
    redirectImpl?: RedirectFn;
    updateSiteForWorkspaceImpl?: typeof updateSiteForWorkspace;
  } = {},
) => {
  return async (
    _previousState: SiteFormState,
    formData: FormData,
  ): Promise<SiteFormState> => {
    'use server';

    const context = await getAuthorizedAppContextImpl();

    if (!context) {
      return redirectImpl('/');
    }

    const values = siteValuesFromFormData(formData);
    const updateResult = await (async () => {
      try {
        return await updateSiteForWorkspaceImpl(context, siteId, values);
      } catch (error) {
        return toSiteFormErrorState(error, values);
      }
    })();

    if (updateResult === null) {
      return redirectImpl('/app');
    }

    if ('values' in updateResult) {
      return updateResult;
    }

    return redirectImpl(`/app/sites/${siteId}`);
  };
};

export const createDeleteSiteAction = (
  siteId: string,
  {
    deleteSiteForWorkspaceImpl = deleteSiteForWorkspace,
    getAuthorizedAppContextImpl = getAuthorizedAppContext,
    redirectImpl = redirect,
  }: {
    deleteSiteForWorkspaceImpl?: typeof deleteSiteForWorkspace;
    getAuthorizedAppContextImpl?: typeof getAuthorizedAppContext;
    redirectImpl?: RedirectFn;
  } = {},
) => {
  return async () => {
    'use server';

    const context = await getAuthorizedAppContextImpl();

    if (!context) {
      return redirectImpl('/');
    }

    await deleteSiteForWorkspaceImpl(context, siteId);
    return redirectImpl('/app');
  };
};
