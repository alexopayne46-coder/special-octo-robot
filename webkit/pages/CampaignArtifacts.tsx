import { useParams, Link } from "react-router-dom";
import { useBackendPack } from "../hooks/useBackendPack";
import CampaignArtifactsPanel from "../components/CampaignArtifactsPanel";

interface CampaignLite {
  id: number;
  name: string;
  campaignType: string;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  scheduled: "badge-warning",
  running: "badge-info",
  completed: "badge-success",
  failed: "badge-error",
};

export default function CampaignArtifacts() {
  const { campaignId } = useParams<{ campaignId: string }>();

  const parsedId = campaignId !== undefined ? Number(campaignId) : null;
  const selectedId = parsedId !== null && Number.isFinite(parsedId) ? parsedId : null;

  const { data: campaigns, loading } = useBackendPack<CampaignLite[]>(
    "AdCampaigns",
    {},
    { errorMessage: "Failed to load campaigns" }
  );

  const selected = campaigns?.find((campaign) => campaign.id === selectedId) ?? null;

  if (selectedId === null) {
    return (
      <div>
        <h1 className="text-4xl font-bold caprasimo-regular mb-6">Campaign Artifacts</h1>
        <p className="text-sm text-base-content/70 mb-4">
          Every campaign keeps its own log of artifacts. Pick a campaign to inspect it.
        </p>

        {loading && (
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {!loading && (!campaigns || campaigns.length === 0) && (
          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>No campaigns found — create one first</span>
          </div>
        )}

        {campaigns && campaigns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table table-zebra table-xs">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <th>{campaign.id}</th>
                    <td className="font-semibold">{campaign.name || "-"}</td>
                    <td className="font-mono text-sm">{campaign.campaignType}</td>
                    <td>
                      <span className={`badge badge-sm ${STATUS_BADGE[campaign.status] ?? "badge-neutral"}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="btn btn-sm btn-ghost"
                        to={`/application/campaigns/${campaign.id}/artifacts`}
                      >
                        Open artifacts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold caprasimo-regular">Artifacts of #{selectedId}</h1>
          {selected && (
            <p className="text-sm text-base-content/70 mt-1">
              {selected.name} · <span className="font-mono">{selected.campaignType}</span> ·{" "}
              <span className={`badge badge-sm ${STATUS_BADGE[selected.status] ?? "badge-neutral"}`}>
                {selected.status}
              </span>
            </p>
          )}
        </div>

        <Link className="btn btn-outline btn-sm" to="/application/campaigns">
          All campaigns
        </Link>
      </div>

      <div className="border border-base-300 rounded-box p-4">
        <CampaignArtifactsPanel key={selectedId} campaignId={selectedId} />
      </div>
    </div>
  );
}
