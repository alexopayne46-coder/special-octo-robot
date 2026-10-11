import { CampaignSPMLifecycle } from './campaign.spm.lifecycle.js';
import { CommonCampaignLifecycle } from './common.campaign.lifecycle.js';
import type { CampaignLifecycle, CampaignLifecycleContext } from './campaign.lifecycle.js';
import type { AdCampaign, CampaignType } from '../models/ad-campaign.js';

export type CampaignLifecycleConstructor = new (
  campaign: AdCampaign,
  context: CampaignLifecycleContext,
) => CampaignLifecycle;

export const CAMPAIGN_LIFECYCLES: Partial<Record<CampaignType, CampaignLifecycleConstructor>> = {
  'SPM::SendToChats': CampaignSPMLifecycle,
  'Common::common': CommonCampaignLifecycle,
};

export function resolveCampaignLifecycle(
  campaign: AdCampaign,
): CampaignLifecycleConstructor | undefined {
  return CAMPAIGN_LIFECYCLES[campaign.campaignType];
}
