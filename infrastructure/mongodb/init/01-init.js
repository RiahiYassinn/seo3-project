// Initialize MongoDB Collections for SEO3 Analytics

db = db.getSiblingDB('seo3_analytics');

// Create collections
db.createCollection('skills');
db.createCollection('developer_skills');
db.createCollection('commits');
db.createCollection('commit_analysis');
db.createCollection('skill_graphs');

// Create indexes

// Skills collection
db.skills.createIndex({ "name": 1 }, { unique: true });
db.skills.createIndex({ "category": 1 });

// Developer Skills collection
db.developer_skills.createIndex({ "developerId": 1 });
db.developer_skills.createIndex({ "skillName": 1 });
db.developer_skills.createIndex({ "developerId": 1, "skillName": 1 }, { unique: true });
db.developer_skills.createIndex({ "proficiency": -1 });

// Commits collection
db.commits.createIndex({ "sha": 1 }, { unique: true });
db.commits.createIndex({ "author": 1 });
db.commits.createIndex({ "repository": 1 });
db.commits.createIndex({ "timestamp": -1 });

// Commit Analysis collection
db.commit_analysis.createIndex({ "commitSha": 1 }, { unique: true });
db.commit_analysis.createIndex({ "technologies.name": 1 });
db.commit_analysis.createIndex({ "categories": 1 });
db.commit_analysis.createIndex({ "processedAt": -1 });

print('MongoDB collections and indexes created successfully');
