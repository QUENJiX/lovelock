# LoveLock ❤️🔒

LoveLock is a playful relationship quiz and photo locker. Upload a photo, set custom questions, and challenge your partner to unlock the vault.

Originally built as a 100% client-side zero-backend app, it now utilizes **Hybrid Zero-Knowledge Storage** via Supabase to keep URL links short and shareable, while maintaining complete privacy. Your images are encrypted directly in the browser *before* they are sent to the database.

## Features
- **Zero-Knowledge Encryption:** Uses PBKDF2 for key derivation and AES-GCM for encryption. Keys are never sent to the server.
- **Short URLs:** Links are kept clean and under 150 characters.
- **Customizable Themes:** Romantic Pink, Golden Hour, Midnight Mood.
- **Progressive Unblurring:** The locked image slowly reveals itself as questions are answered.

## Setup & Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase**
   - Head to [Supabase](https://supabase.com/) and create a new project.
   - Run the following SQL in your Supabase SQL Editor to set up the storage table:
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
   - Rename `.env.example` to `.env` and fill in your Project URL and Anon Key.

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Deployment (GitHub Pages)

Because this app uses Vite and requires environment variables injected at build time, the best way to deploy to GitHub Pages is via a GitHub Actions workflow.

1. Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Repository Secrets.
3. Use a GitHub Action workflow to build the project and deploy the `dist/` folder to your `gh-pages` branch.