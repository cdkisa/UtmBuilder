import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Input, Select, Badge } from '../components/UI';
import Modal from '../components/Modal';
import { exportToCsv } from '../utils/utm';
import db from '../db';

export default function MembersPage() {
  const toast = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [search, setSearch] = useState('');

  const members = useLiveQuery(
    () => db.members.toArray(),
    []
  ) || [];

  const filtered = members.filter(m =>
    !search || m.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemove = async (id) => {
    const member = members.find(m => m.id === id);
    if (member?.isAdmin) { toast("Can't remove workspace admin", 'error'); return; }
    if (!confirm('Remove this member from workspace?')) return;
    await db.members.delete(id);
    toast('Member removed');
  };

  const handleToggleAdmin = async (id, current) => {
    await db.members.update(id, { isAdmin: !current });
    toast(`Admin ${!current ? 'granted' : 'revoked'}`);
  };

  const handleRoleChange = async (id, role) => {
    await db.members.update(id, { role });
    toast('Role updated');
  };

  const handleExport = () => {
    const data = filtered.map(m => ({
      email: m.email, status: m.status, role: m.role || '',
      workspace_admin: m.isAdmin ? 'Yes' : 'No',
    }));
    exportToCsv(data, `utm-members-${Date.now()}.csv`);
    toast('Exported');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Members</h1>
        <Button variant="secondary" size="sm" onClick={handleExport}>Export to CSV</Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowInvite(true)}>INVITE MEMBER</Button>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs cursor-pointer hover:text-gray-700">Email ↑</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Rule</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Workspace Admin</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-gray-800">{m.email}</td>
                <td className="px-4 py-3">
                  <Badge color={m.status === 'Active' ? 'green' : 'gray'}>{m.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <RuleDropdown memberId={m.id} currentRole={m.role} onChange={handleRoleChange} />
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={m.isAdmin || false}
                    onChange={() => handleToggleAdmin(m.id, m.isAdmin)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                </td>
                <td className="px-4 py-3">
                  <Button variant="secondary" size="sm" onClick={() => handleRemove(m.id)}>
                    Remove from workspace
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon="👥" message="No members yet!"
            action={<Button onClick={() => setShowInvite(true)}>Invite Member</Button>} />
        )}
      </div>
      <div className="mt-3 text-xs text-gray-400">{filtered.length} records</div>

      <InviteMemberModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}

function RuleDropdown({ memberId, currentRole, onChange }) {
  return (
    <select value={currentRole || ''} onChange={e => onChange(memberId, e.target.value)}
      className="px-2 py-1 border border-gray-200 rounded text-xs outline-none bg-white">
      <option value="">No rule</option>
      <option value="Member">Member</option>
      <option value="Viewer">Viewer</option>
    </select>
  );
}

function InviteMemberModal({ open, onClose }) {
  const toast = useToast();
  const [rows, setRows] = useState([{ email: '', role: 'Member' }]);

  const addRow = () => {
    setRows([...rows, { email: '', role: 'Member' }]);
  };

  const updateRow = (i, field, value) => {
    const next = [...rows];
    next[i][field] = value;
    setRows(next);
  };

  const handleConfirm = async () => {
    let count = 0;
    for (const row of rows) {
      if (!row.email.trim()) continue;
      await db.members.add({
        email: row.email.trim(),
        role: row.role, status: 'Active', isAdmin: false,
      });
      count++;
    }
    if (count === 0) { toast('Enter at least one email', 'error'); return; }
    toast(`${count} member(s) invited`);
    setRows([{ email: '', role: 'Member' }]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite Users" width="max-w-xl">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-3 mb-3">
          <div>
            {i === 0 && <label className="block text-xs font-semibold text-brand-600 mb-1">Email Address</label>}
            <input value={row.email} onChange={e => updateRow(i, 'email', e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
          </div>
          <div>
            {i === 0 && <label className="block text-xs font-semibold text-brand-600 mb-1"><span className="text-red-500">*</span> Role</label>}
            <select value={row.role} onChange={e => updateRow(i, 'role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
              <option value="Member">Member</option>
              <option value="Viewer">Viewer</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      ))}

      <button onClick={addRow} className="text-sm text-gray-500 hover:text-gray-700 mb-5 flex items-center gap-1">
        <span>+</span> Add more users
      </button>

      <div className="flex justify-end">
        <Button onClick={handleConfirm}>CONFIRM</Button>
      </div>
    </Modal>
  );
}
