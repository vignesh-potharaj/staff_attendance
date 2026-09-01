import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function dynamicPwaManifestPlugin() {
  return {
    name: 'dynamic-pwa-manifest',
    generateBundle(this: any) {
      const isDev = process.env.VITE_APP_ENV === 'development' || 
                    process.env.VERCEL_ENV === 'preview';

      const manifestData = {
        name: isDev ? "Smart Admin (DEV)" : "Smart Attendance Admin",
        short_name: isDev ? "Admin (DEV)" : "SmartAdmin",
        description: "Admin Hub for Smart Staff Attendance System.",
        id: isDev ? "com.smart.attendance.admin.dev" : "com.smart.attendance.admin",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: isDev ? "#d97706" : "#4f46e5",
        categories: ["business", "productivity", "utilities"],
        dir: "ltr",
        lang: "en-US",
        prefer_related_applications: false,
        launch_handler: {
          client_mode: ["navigate-existing", "auto"]
        },
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        screenshots: [
          { src: "/screenshots/login.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Login Screen" },
          { src: "/screenshots/dashboard.png", sizes: "1000x1000", type: "image/png", form_factor: "wide", label: "Admin Dashboard Overview" },
          { src: "/screenshots/attendance.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Attendance Management" },
          { src: "/screenshots/users.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "User Administration" }
        ],
        shortcuts: [
          { name: "Attendance Records", short_name: "Attendance", description: "View daily staff attendance records", url: "/attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "User Management", short_name: "Users", description: "Manage registered staff members", url: "/users", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
        ]
      };

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(manifestData, null, 2)
      });
    },
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/manifest.json') {
          const isDev = process.env.VITE_APP_ENV !== 'production';
          const manifestData = {
            name: isDev ? "Smart Admin (DEV)" : "Smart Attendance Admin",
            short_name: isDev ? "Admin (DEV)" : "SmartAdmin",
            description: "Admin Hub for Smart Staff Attendance System.",
            id: isDev ? "com.smart.attendance.admin.dev" : "com.smart.attendance.admin",
            start_url: "/",
            scope: "/",
            display: "standalone",
            display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
            orientation: "portrait",
            background_color: "#ffffff",
            theme_color: isDev ? "#d97706" : "#4f46e5",
            categories: ["business", "productivity", "utilities"],
            dir: "ltr",
            lang: "en-US",
            prefer_related_applications: false,
            launch_handler: {
              client_mode: ["navigate-existing", "auto"]
            },
            icons: [
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
              { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
            ],
            screenshots: [
              { src: "/screenshots/login.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Login Screen" },
              { src: "/screenshots/dashboard.png", sizes: "1000x1000", type: "image/png", form_factor: "wide", label: "Admin Dashboard Overview" },
              { src: "/screenshots/attendance.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "Attendance Management" },
              { src: "/screenshots/users.png", sizes: "1000x1000", type: "image/png", form_factor: "narrow", label: "User Administration" }
            ],
            shortcuts: [
              { name: "Attendance Records", short_name: "Attendance", description: "View daily staff attendance records", url: "/attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
              { name: "User Management", short_name: "Users", description: "Manage registered staff members", url: "/users", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }
            ]
          };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(manifestData, null, 2));
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dynamicPwaManifestPlugin()],
  base: "/",
  server: {
    port: 5173,
  },
})
