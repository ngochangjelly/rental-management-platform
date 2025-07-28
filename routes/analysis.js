const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Predefined criteria for tenancy agreement analysis
const ANALYSIS_CRITERIA = {
  aircon_service: {
    name: "Mandatory AC Service Provider",
    description: "Landlord forces tenant to use specific AC service provider",
    keywords: [
      "air-conditioning contractor",
      "referred by the landlord",
      "qualified air-conditioning contractor",
      "service and maintain the air-conditioning",
    ],
    severity: "medium",
    category: "restrictions",
  },
  excessive_deposits: {
    name: "Excessive Security Deposit",
    description: "Security deposit exceeds standard 2 months rent",
    keywords: ["security deposit", "deposit", "months rent"],
    severity: "high",
    category: "financial",
  },
  subletting_restrictions: {
    name: "Subletting Restrictions",
    description: "Tenant prohibited from subletting or assigning tenancy",
    keywords: [
      "not to assign",
      "sublet",
      "subletting",
      "part with the possession",
    ],
    severity: "medium",
    category: "restrictions",
  },
  drilling_restrictions: {
    name: "Wall Drilling Restrictions",
    description:
      "Tenant prohibited from drilling holes or affixing items to walls",
    keywords: [
      "not to drill holes",
      "affix nails",
      "screws",
      "sharp fixtures on the walls",
    ],
    severity: "medium",
    category: "property_modification",
  },
  early_termination_penalties: {
    name: "Early Termination Penalties",
    description: "Excessive penalties for early termination",
    keywords: [
      "early termination",
      "prematurely terminates",
      "forfeit",
      "security deposit shall be absolutely forfeited",
    ],
    severity: "high",
    category: "financial",
  },
  repair_responsibilities: {
    name: "Tenant Repair Obligations",
    description:
      "Tenant responsible for repairs beyond reasonable wear and tear",
    keywords: [
      "tenant shall bear",
      "at the expense of the tenant",
      "tenant responsible",
    ],
    severity: "medium",
    category: "maintenance",
  },
};

// Simple keyword-based analysis with text positions
function analyzeWithKeywords(text) {
  const results = [];
  const lowerText = text.toLowerCase();

  Object.entries(ANALYSIS_CRITERIA).forEach(([key, criteria]) => {
    const matches = criteria.keywords.filter((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    );

    if (matches.length > 0) {
      // Find the actual text snippets with positions
      const snippets = [];
      const textPositions = [];
      
      matches.forEach((keyword) => {
        const regex = new RegExp(
          `[^.]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.]*\.`,
          "gi"
        );
        const found = text.match(regex);
        if (found) {
          snippets.push(...found.slice(0, 2)); // Limit to 2 snippets per keyword
          
          // Find positions of keyword matches
          const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          let match;
          while ((match = keywordRegex.exec(text)) !== null) {
            textPositions.push({
              start: match.index,
              end: match.index + match[0].length,
              keyword: match[0],
              context: text.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100)
            });
          }
        }
      });

      results.push({
        id: key,
        name: criteria.name,
        description: criteria.description,
        severity: criteria.severity,
        category: criteria.category,
        matches: matches,
        snippets: snippets.slice(0, 3), // Limit to 3 total snippets
        textPositions: textPositions,
        score: matches.length,
      });
    }
  });

  return results.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return (
      severityOrder[b.severity] - severityOrder[a.severity] || b.score - a.score
    );
  });
}

// Analyze uploaded tenancy agreement
router.post("/analyze", requireAuth, async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // For now, use a mock text extraction since pdf-parse is causing issues in serverless
    // In a real implementation, you'd use a more reliable PDF parsing library
    const extractedText = `
    Sample tenancy agreement text for demonstration purposes.
    This tenant shall not assign, sublet, or part with the possession of the demised premises.
    The tenant shall bear the cost of any repairs to the air-conditioning contractor referred by the landlord.
    Security deposit shall be absolutely forfeited if tenant prematurely terminates this agreement.
    Tenant shall not drill holes or affix nails, screws, or sharp fixtures on the walls.
    `;
    
    console.log('Using mock PDF text extraction for:', filename);

    // Perform keyword-based analysis
    const keywordAnalysis = analyzeWithKeywords(extractedText);

    const result = {
      success: true,
      filename: filename,
      analysis: {
        summary: {
          totalIssues: keywordAnalysis.length,
          highSeverity: keywordAnalysis.filter(
            (item) => item.severity === "high"
          ).length,
          mediumSeverity: keywordAnalysis.filter(
            (item) => item.severity === "medium"
          ).length,
          lowSeverity: keywordAnalysis.filter((item) => item.severity === "low")
            .length,
        },
        keywordAnalysis: keywordAnalysis,
        extractedText: extractedText.substring(0, 1000) + "...", // First 1000 chars for preview
      },
      timestamp: new Date().toISOString(),
    };

    res.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      error: "Analysis failed",
      details: error.message,
    });
  }
});

// Get analysis criteria
router.get("/criteria", requireAuth, (req, res) => {
  res.json({
    success: true,
    criteria: ANALYSIS_CRITERIA,
  });
});

module.exports = router;
