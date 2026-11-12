/**
 * How each AI/ML Engineer notebook ticket is solved, in a few sentences. Shown only after the ticket has closed (the grade message), never while the student is
 * working: the method is what the student should take away, and a closed ticket is never served to them again with the same data.
 */
export const ML_METHODS: Readonly<Record<string, string>> = {
  "mle-contract-validation": "Check each rule on its own: a field is missing if it is empty, out of range if a number falls outside the inclusive limits, and a bad category if it is not an exact allowed value. Count a request once, under the first rule it breaks.",
  "mle-model-budget": "Filter the candidates to those inside both limits first, then take the most accurate of what is left. The most accurate model overall is the trap: it breaks the budget.",
  "mle-shadow-promotion": "Compute recall and precision for each version from the same log (true positives over actual positives, and over predicted positives), then apply the written rule exactly: recall higher AND precision at the floor.",
  "mle-store-slices": "Group the results by store and compute the metric inside each group. A good overall score can hide one slice where the model is wrong most of the time.",
  "mle-region-misses": "Count the missed leavers by region, find the region with the biggest share of the misses, and work out the recall you would have if that region were fixed.",
  "mle-depth-sweep": "Choose the depth with the best validation accuracy, not training accuracy. Training accuracy only ever rises with depth; the point where validation stops rising is where the tree starts to overfit.",
  "mle-class-weights": "Divide the rows by (classes x rows in that class) to get balanced weights. When only a few percent of rows are positive, a model that never predicts positive still scores a high accuracy.",
  "mle-train-test-overlap": "Join the two files on the customer id. Customers in both files make the test score optimistic: only the customers who appear in test alone are really unseen.",
  "mle-ratio-features": "Divide each total by months active before comparing, then average the per-customer ratios. Totals mostly measure tenure; the ratio measures behaviour.",
  "mle-rare-cities": "Count rows per city, keep the cities with at least MIN_ROWS, send the rest to one 'other' group, and one-hot encode: one column per kept city plus one for 'other'.",
  "mle-date-features": "Parse the timestamps, take the weekday and hour of each order, and for each customer subtract their latest order from the snapshot date in whole days. Always measure from the snapshot, never from today.",
  "mle-target-encoding": "The plain encoding is the mean of the label per category, which for a rare category includes the row's own label. Leave-one-out removes that row first, so the feature cannot peek at its own answer.",
  "mle-pick-by-validation": "Select on validation, report on test. If you pick on the test score you have used the test set to tune, so its score is no longer an honest estimate; the trap run usually wins only by luck.",
  "mle-repro-audit": "Keep only the runs where seed, code version and data version are all recorded, then take the best of those. A run you cannot re-create is not something you can ship, however good its score.",
  "mle-seed-variance": "Average each configuration over its seeds and compute the sample standard deviation (ddof=1). A gain smaller than about two standard deviations is inside the noise between seeds, so it is not evidence B is better.",
  "mle-feature-drift": "For each feature turn the bin counts into shares p (training) and q (last week), then add (q - p) x ln(q / p) over the bins. A PSI above 0.2 means the input distribution has shifted enough to investigate.",
  "mle-rolling-recall-alert": "For each day from day 7, add caught and missed over the last 7 days and divide: caught / (caught + missed). Pool the counts rather than averaging daily recalls, then alert whenever that is below the floor.",
  "mle-nn-forward": "Multiply the inputs by W1 and add b1, apply ReLU (negative values become 0), multiply by W2 and add b2, apply the sigmoid, then average the binary cross-entropy -(y ln p + (1 - y) ln(1 - p)).",
  "mle-nn-backprop": "Run forward to get h and p. For a sigmoid output with cross-entropy, d loss/d z = p - y. Then dw2 = (p - y) x h, and passing back through the ReLU (slope 1 when h > 0), dw1 = (p - y) x w2 x x. Each weight moves by minus the learning rate times its gradient.",
  "mle-cv-comparison": "Average each model's five folds and take the sample standard deviation. The best mean wins only clearly if its lead over the runner-up is bigger than its own fold-to-fold spread; the most stable model is the one with the smallest deviation.",
  "mle-grid-search": "Choose the combination with the best validation accuracy. The highest training accuracy is the trap: a combination whose training score is far above its validation score has memorised the training data.",
  "mle-kmeans-elbow": "Take second differences of the inertia curve: inertia[k-1] - 2 x inertia[k] + inertia[k+1]. The k where the curve bends the most (the largest second difference) is the elbow, where adding clusters stops paying off.",
  "mle-roc-auc": "AUC is the share of (leaver, stayer) pairs where the leaver has the higher score, counting a tie as half. Recall and false positive rate at 0.5 come from counting scores of 0.5 or more among leavers and among stayers.",
  "mle-pca-variance": "Explained variance ratio is each eigenvalue divided by the sum of all eigenvalues. Add them up in order and keep the smallest number of components whose total reaches 90%.",
  "mle-leakage-easy": "Find the column that would not exist at prediction time (it only exists because the outcome already happened) and drop it before training. A model that is perfect on history and a guess on new data has usually seen the answer.",
  "mle-eval-confusion": "Build the confusion matrix (true and false positives and negatives), then precision = TP / (TP + FP), recall = TP / (TP + FN), F1 = their harmonic mean. Compare accuracy with a baseline that always predicts the majority class.",
  "mle-zscores": "Subtract the column mean and divide by its standard deviation. Use the training mean and deviation only, and apply the same numbers to any new data.",
};
