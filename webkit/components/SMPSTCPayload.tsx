import JsonPayloadEditor from "./JsonPayloadEditor";

interface ChatGroupOption {
  id: number;
  name: string;
  chatCount: number;
}

interface SMPSTCPayloadChat {
  id: number;
  peerId: number | null;
  title: string | null;
  username: string | null;
  groupId: number | null;
}

interface SMPSTCPayloadProps {
  messageText: string;
  onMessageTextChange: (text: string) => void;
  groupId: number | null;
  onGroupChange: (id: number | null) => void;
  payload: Record<string, any>;
  onPayloadChange: (next: Record<string, any>) => void;
  groups: ChatGroupOption[] | null;
  groupChats: SMPSTCPayloadChat[] | null;
  hidePayloadSettings?: boolean;
}

export default function SMPSTCPayload({
  messageText,
  onMessageTextChange,
  groupId,
  onGroupChange,
  payload,
  onPayloadChange,
  groups,
  groupChats,
  hidePayloadSettings = false,
}: SMPSTCPayloadProps) {
  return (
    <fieldset className="fieldset space-y-1">
      <legend className="label-text font-semibold mb-2">SPM:SendToChats payload</legend>

      <label className="label">
        <span className="label-text">Text of message</span>
      </label>
      <textarea
        className="textarea textarea-bordered w-full"
        rows={4}
        value={messageText}
        onChange={(e) => onMessageTextChange(e.target.value)}
        placeholder="Message text that will be sent to the chats"
      />

      <label className="label py-1">
        <span className="label-text">Group of chats</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={groupId ? String(groupId) : ""}
        onChange={(e) => onGroupChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">No group</option>
        {(groups ?? []).map((group) => (
          <option key={group.id} value={String(group.id)}>
            {group.name} ({group.chatCount})
          </option>
        ))}
      </select>

      {groupId !== null && (
        <p className="text-sm text-base-content/70">
          {groupChats?.length ?? 0} chat(s) from this group will receive the campaign
        </p>
      )}

      {!hidePayloadSettings && <JsonPayloadEditor value={payload} onChange={onPayloadChange} />}
    </fieldset>
  );
}
