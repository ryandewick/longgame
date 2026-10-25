/**
 * Whether the "Add an account" dialog is open. The menu of accounts in the top bar opens it;
 * `AddAccountDialog` (in the planner's layout) draws it and adds the account through useAccounts.
 */
export function useAddAccount(): {
  isOpen: Readonly<Ref<boolean>>
  open: () => void
  close: () => void
} {
  const isOpen = useState('add-account-open', () => false)

  function open(): void {
    if (import.meta.client) isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  return { isOpen: readonly(isOpen), open, close }
}
