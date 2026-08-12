// components/members-client.tsx
'use client'

import { useState } from 'react'
import Papa from 'papaparse'

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
}

interface MembersClientProps {
  initialMembers: Member[]
  updateMemberAction: (id: string, name: string, email: string, phone: string) => Promise<void>
  upsertMembersAction: (members: { name: string; email: string; phone?: string }[]) => Promise<void>
  deleteMemberAction: (id: string) => Promise<void>
}

export default function MembersClient({
  initialMembers,
  updateMemberAction,
  upsertMembersAction,
  deleteMemberAction,
}: MembersClientProps) {
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  // Handle Single Member Edit Form Submit
  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingMember) return

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string

    await updateMemberAction(editingMember.id, name, email, phone)
    setEditingMember(null)
  }

  // Handle Bulk CSV Upload & Upsert
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus('Parsing CSV file...')

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedData = results.data.map((row: any) => ({
            name: row.name || row.Name || row['Member Name'] || '',
            email: row.email || row.Email || row['Email Address'] || '',
            phone: row.phone || row.Phone || row['Phone Number'] || '',
          })).filter(m => m.email && m.name)

          if (parsedData.length === 0) {
            setUploadStatus('Error: No valid rows found. Ensure CSV has "name" and "email" headers.')
            setIsUploading(false)
            return
          }

          setUploadStatus(`Upserting ${parsedData.length} members...`)
          await upsertMembersAction(parsedData)
          setUploadStatus(`Successfully processed ${parsedData.length} members!`)
        } catch (err) {
          console.error(err)
          setUploadStatus('Error importing CSV file.')
        } finally {
          setIsUploading(false)
        }
      },
      error: () => {
        setUploadStatus('Failed to parse CSV file.')
        setIsUploading(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* CSV Bulk Upload Header Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Bulk Import / Upsert Roster</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload a CSV master list with <code className="text-emerald-400">name, email, phone</code> headers. Matching emails will update existing member records.
          </p>
        </div>

        <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs rounded-lg text-white transition cursor-pointer flex items-center gap-2">
          <span>{isUploading ? 'Processing...' : 'Upload CSV Master File'}</span>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            disabled={isUploading}
            className="hidden" 
          />
        </label>
      </div>

      {uploadStatus && (
        <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg">
          {uploadStatus}
        </p>
      )}

      {/* Members Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Active Roster ({initialMembers.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
                <th className="pb-3 font-semibold">Member Name</th>
                <th className="pb-3 font-semibold">Email</th>
                <th className="pb-3 font-semibold">Phone</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-950/50 transition">
                  <td className="py-4 font-medium text-white">{member.name}</td>
                  <td className="py-4 text-slate-300">{member.email}</td>
                  <td className="py-4 text-slate-400">{member.phone || '—'}</td>
                  <td className="py-4 text-right space-x-3">
                    <button
                      onClick={() => setEditingMember(member)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Remove ${member.name} from the roster?`)) {
                          await deleteMemberAction(member.id)
                        }
                      }}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Edit Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold">Edit Member Record</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                <input
                  name="name"
                  defaultValue={editingMember.name}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email Address</label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingMember.email}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Phone Number</label>
                <input
                  name="phone"
                  defaultValue={editingMember.phone || ''}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}