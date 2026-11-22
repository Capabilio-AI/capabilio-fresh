// Which role skills each Arena area exercises. The product's own Arena areas for these two roles are not linked to skills yet, so a demo student's
// tickets are linked here, in the student's own evidence rows only (the shared configuration is not touched).
export const AREA_SKILLS: Record<string, string[]> = {
  "exploratory-analysis": ["Exploratory Data Analysis", "Data Analysis", "Data Cleaning"],
  "feature-engineering": ["Feature Engineering", "Data Wrangling with Pandas"],
  "model-building": ["Machine Learning", "Python"],
  "model-evaluation": ["Model Evaluation and Metrics", "Statistics"],
  "experiment-design": ["Hypothesis Testing", "Statistics", "Probability"],
  "data-storytelling": ["Data Storytelling", "Data Analysis"],
  "data-preparation": ["Data Wrangling with Pandas", "Python"],
  "ml-feature-engineering": ["Feature Engineering", "Python"],
  "model-training": ["Machine Learning", "Neural Network Fundamentals", "Optimization and Gradient Descent"],
  evaluation: ["Model Evaluation and Metrics", "Statistics"],
  "training-hygiene": ["Overfitting and Regularization", "Machine Learning"],
  "error-analysis": ["Model Evaluation and Metrics", "Machine Learning"],
  "model-deployment": ["Model Deployment Basics", "Software Engineering"],
  "drift-monitoring": ["Model Deployment Basics", "Statistics"],
  "experiment-tracking": ["Software Engineering", "Machine Learning"],
  "neural-networks": ["Neural Network Fundamentals", "Deep Learning"],
  "mle-python": ["Python", "Algorithms"],
  "mlops-config": ["Model Deployment Basics", "Software Engineering"],
};
