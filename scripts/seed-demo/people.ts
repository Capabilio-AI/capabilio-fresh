// The two demo students. Names are fictional.
export interface Demo {
  slug: string;
  email: string;
  name: string;
  roll: string;
  headline: string;
  bio: string;
  location: string;
  careerKey: string;
  careerName: string;
  /** -1..1: how strong the student is overall; shifts every generated score */
  strength: number;
}

export const DEMOS: Demo[] = [
  {
    slug: "ananya-rao-ds", email: "demo.datascience@capabilio.test", name: "Ananya Rao", roll: "CTC23CS041",
    headline: "Final-year CSE student | Aspiring Data Scientist",
    bio: "Final-year student who builds forecasting and classification models and explains them in plain language. Comfortable with Python, SQL and statistics, and looking for a data science role.",
    location: "Hyderabad, India", careerKey: "data-scientist", careerName: "Data Scientist", strength: 0.35,
  },
  {
    slug: "rohan-mehta-ml", email: "demo.aiml@capabilio.test", name: "Rohan Mehta", roll: "CTC23CS058",
    headline: "Final-year CSE student | Aspiring AI/ML Engineer",
    bio: "Final-year student focused on machine learning systems: training, evaluating and shipping models. Works in Python with PyTorch and scikit-learn, and looking for an AI/ML engineer role.",
    location: "Bengaluru, India", careerKey: "ai-ml-engineer", careerName: "AI/ML Engineer", strength: 0.3,
  },
];
