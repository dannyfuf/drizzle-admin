import { styles, tailwindScript } from './styles.js'
import { escapeHtml } from './components/flash.js'
import { csrfInput } from '../auth/csrf.js'

export interface LoginProps {
  csrfToken: string
  error?: string
}

export function loginPage(props: LoginProps): string {
  const { csrfToken, error } = props

  return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In | DrizzleAdmin</title>
  ${tailwindScript}
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="${styles.bg} ${styles.text} min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold">DrizzleAdmin</h1>
      <p class="${styles.textMuted}">Sign in to continue</p>
    </div>

    <div class="${styles.cardPadded}">
      ${error ? `
        <div class="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
          ${escapeHtml(error)}
        </div>
      ` : ''}

      <form method="POST" action="/login" class="space-y-4">
        ${csrfInput(csrfToken)}

        <div>
          <label for="email" class="${styles.label}">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autocomplete="email"
            class="${styles.input}"
            placeholder="admin@example.com"
          >
        </div>

        <div>
          <label for="password" class="${styles.label}">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            autocomplete="current-password"
            class="${styles.input}"
          >
        </div>

        <button type="submit" class="${styles.btnPrimary} w-full">
          Sign in
        </button>
      </form>
    </div>
  </div>
</body>
</html>
`
}
