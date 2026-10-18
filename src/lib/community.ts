export type CommunityLink = { label: string; url: string };

export type CommunityMember = {
  id: string;
  name: string;
  role: string;
  country: string | null;
  skills: string | null;
  participation: string | null;
  institution: string | null;
  socialLinks: string | null;
  links: CommunityLink[];
  avatarUrl: string | null;
  initial: string;
  joinedAt?: string;
};

export const ROLE_OPTIONS = [
  "Developer",
  "AI / ML Engineer",
  "Designer",
  "Researcher",
  "Student",
  "Founder",
  "Data Scientist",
  "DevOps / SRE",
  "Product Manager",
  "Technical Writer",
  "Educator",
  "Community Manager",
  "Prompt Engineer",
  "Automation Engineer",
  "Security Engineer",
  "Mobile Developer",
  "Full-Stack Developer",
  "Backend Developer",
  "Frontend Developer",
  "Hardware / Embedded",
  "Robotics Engineer",
  "QA / Test Engineer",
  "Open-Source Maintainer",
  "Content Creator",
  "Hobbyist",
  "Other",
];

export const LINK_PRESETS = [
  "Website",
  "GitHub",
  "LinkedIn",
  "X (Twitter)",
  "YouTube",
  "Discord",
  "Instagram",
  "Facebook",
  "Threads",
  "Telegram",
  "TikTok",
  "Reddit",
  "Medium",
  "Dev.to",
  "Stack Overflow",
  "Kaggle",
  "Hugging Face",
  "Behance",
  "Dribbble",
  "Blog",
  "Email",
  "Other",
];

export const COUNTRY_OPTIONS = [
  "Bangladesh",
  "India",
  "Pakistan",
  "Nepal",
  "Sri Lanka",
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Italy",
  "Poland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Ireland",
  "Switzerland",
  "Austria",
  "Belgium",
  "Portugal",
  "Czechia",
  "Romania",
  "Ukraine",
  "Turkey",
  "Russia",
  "Egypt",
  "Nigeria",
  "Kenya",
  "Ghana",
  "South Africa",
  "Morocco",
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
  "Israel",
  "Iran",
  "Iraq",
  "China",
  "Japan",
  "South Korea",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Australia",
  "New Zealand",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Mexico",
  "Peru",
  "Other",
];

export const SKILL_SUGGESTIONS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C++",
  "C#",
  "React",
  "SolidJS",
  "Vue",
  "Node.js",
  "Electron",
  "Machine Learning",
  "Deep Learning",
  "LLM / Agents",
  "Prompt Engineering",
  "Computer Vision",
  "NLP",
  "UI / UX",
  "Product Design",
  "TailwindCSS",
  "Cloud",
  "AWS",
  "GCP",
  "Azure",
  "Docker",
  "Kubernetes",
  "DevOps",
  "CI / CD",
  "Data Science",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Security",
  "Pentesting",
  "Robotics",
  "Embedded Systems",
  "Automation",
  "Technical Writing",
  "Open Source",
  "Community",
  "Video / Media",
];

export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function linkLabel(link: CommunityLink) {
  return link.label?.trim() || linkHost(link.url);
}
