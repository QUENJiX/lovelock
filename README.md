# LoveLock ❤️🔒

LoveLock is a gamified relationship quiz and photo locker. Upload a secret photo, define custom trivia questions, and challenge your partner to unlock the vault. 

Designed with strict privacy in mind, LoveLock employs a **Zero-Knowledge Architecture**. Your photos are securely encrypted directly within your browser, ensuring that the server never has access to the underlying images or the decryption keys.

## ✨ Features

- **Zero-Knowledge Encryption**: Uses PBKDF2 for key derivation and AES-GCM (256-bit) for encryption. The server stores only ciphertext; the decryption key is derived exclusively from the correct quiz answers.
- **Dynamic Progressive Unblur**: The locked image provides a tantalizing, heavily blurred preview that dynamically becomes clearer as questions are successfully answered.
- **Short, Shareable Links**: By utilizing a lightweight Supabase backend for payload storage, generated lock URLs are kept incredibly clean and short.
- **Customizable Themes**: Tailor the experience with beautifully designed UI themes (Romantic Pink, Golden Hour, Midnight Mood).
- **Ephemeral Storage**: Locks and their encrypted payloads are designed to self-destruct after 24 hours.

## 🔒 Security Architecture

1. The user uploads an image and sets the correct answers to their quiz.
2. The answers are concatenated and hashed. This hash acts as the passphrase to derive an AES-GCM decryption key via PBKDF2 locally in the browser.
3. The image is encrypted using the derived key.
4. Only the AES-encrypted payload (`encData`), a heavily pixelated and blurred thumbnail, and the SHA-256 hashes of the correct answers are sent to the database.
5. The decryption key is **never** sent to the server. It is mathematically impossible to decrypt the image without knowing the correct answers to the quiz.

*(For detailed security analysis and known UX trade-offs, see [SECURITY_NOTES.md](./SECURITY_NOTES.md))*

## 🚀 Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase
LoveLock uses [Supabase](https://supabase.com/) as a lightweight JSON store for the encrypted payloads.
1. Create a new project in Supabase.
2. Run the following SQL in your Supabase SQL Editor to set up the storage table:
   ```sql
   CREATE TABLE public.locks (
       id text PRIMARY KEY,
       payload jsonb NOT NULL,
       created_at timestamp with time zone DEFAULT now()
   );
   
   ALTER TABLE public.locks ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Allow public inserts" ON public.locks FOR INSERT TO anon WITH CHECK (true);
   CREATE POLICY "Allow public reads" ON public.locks FOR SELECT TO anon USING (true);
   ```
3. **(Optional) 24-Hour Auto-Delete**: Ensure encrypted payloads are wiped automatically by running this cron job setup:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   
   SELECT cron.schedule(
     'delete-expired-locks',
     '0 * * * *',
     $$ DELETE FROM public.locks WHERE created_at < NOW() - INTERVAL '24 hours'; $$
   );
   ```
4. Rename `.env.example` to `.env` and fill in your Project URL and Anon Key.

### 3. Run Development Server
```bash
npm run dev
```

## 🌐 Deployment (GitHub Pages)

Because this app is built with Vite and requires environment variables injected at build time, the recommended deployment method is via a GitHub Actions workflow.

1. Navigate to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Repository Secrets.
3. Use a standard Vite GitHub Action workflow to build the project and deploy the output `dist/` directory to your `gh-pages` branch. The app comes pre-configured with a custom `404.html` and router fallback to handle invalid links smoothly.