export interface GhostProfile {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean | null;
    is_private?: boolean | null;
}

export const DIVERSE_GHOST_NAMES = [
    // Muslim
    { name: "Omar Al-Fayed", username: "omar_fayed" },
    { name: "Fatima Zahra", username: "fatima_z" },
    { name: "Zaid Mansour", username: "zaid_matrix" },
    { name: "Aisha Siddiqa", username: "aisha_sd" },
    { name: "Hassan Raza", username: "hassan_raza" },
    // Jewish
    { name: "David Cohen", username: "david_cohen" },
    { name: "Sarah Levi", username: "sarah_levi" },
    { name: "Isaac Rosenberg", username: "isaac_r" },
    { name: "Miriam Goldberg", username: "miriam_g" },
    { name: "Ari Shapiro", username: "ari_shapi" },
    // Hindu
    { name: "Arjun Sharma", username: "arjun_sharma" },
    { name: "Priya Patel", username: "priya_p" },
    { name: "Rohan Gupta", username: "rohan_g" },
    { name: "Anjali Singh", username: "anjali_s" },
    { name: "Vikram Malhotra", username: "vikram_m" },
    // Christian
    { name: "John Smith", username: "john_smith" },
    { name: "Mary Jane", username: "mary_jane_99" },
    { name: "Robert Wilson", username: "robert_w" },
    { name: "Elizabeth Taylor", username: "liz_taylor" },
    { name: "Michael Brown", username: "michael_b" }
];

export const GHOST_FOLLOWERS: GhostProfile[] = DIVERSE_GHOST_NAMES.slice(0, 8).map((data, i) => ({
    user_id: `ghost-${i + 1}`,
    username: data.username,
    display_name: data.name,
    avatar_url: `https://images.unsplash.com/photo-${1500648767791 + i}-00dcc994a43e?w=100&h=100&fit=crop`,
    is_verified: i % 2 === 0,
    is_private: true
}));
