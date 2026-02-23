interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
	readonly VITE_ADMIN_NAME?: string;
	readonly VITE_ADMIN_SECRET?: string;
	readonly VITE_ADMIN_ROUTE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}


