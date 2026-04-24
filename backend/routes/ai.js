// ============================================================
// routes/ai.js  — AI-powered content recommendation engine
//
// POST /api/ai/search            — search with restrictions
// GET  /api/ai/suggestions/:id   — personalised home feed
//
// Uses OpenAI gpt-4o-mini to generate age-appropriate
// content recommendations that strictly respect the parent's
// restrictions stored in the database.
// ============================================================

const express = require('express');
const OpenAI  = require('openai');
const db      = require('../database/db');

const router = express.Router();

// Initialise the OpenAI client once (reads OPENAI_API_KEY from .env)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Helper: build restriction block for the system prompt ──────────────────
function buildRestrictionContext(child) {
  const lines = [];

  lines.push(`• Maximum content rating: ${child.max_content_rating || 'G'}`);

  if (child.allowed_categories && child.allowed_categories.length > 0) {
    lines.push(`• ONLY recommend content from these categories: ${child.allowed_categories.join(', ')}`);
  }

  if (child.blocked_keywords && child.blocked_keywords.length > 0) {
    lines.push(`• NEVER recommend anything involving: ${child.blocked_keywords.join(', ')}`);
  }

  lines.push(`• Violence level allowed: ${child.violence_level || 'none'}`);

  if (!child.allow_scary_content) {
    lines.push('• NO scary, horror, or frightening content whatsoever');
  }

  if (child.educational_only) {
    lines.push('• Return ONLY educational content — no pure entertainment');
  }

  if (child.parent_notes) {
    lines.push(`• Parent instruction: ${child.parent_notes}`);
  }

  return lines.join('\n');
}

// ── Helper: age-appropriate fallback when OpenAI is unavailable ────────────
function fallbackRecommendations(age) {
  const forYoung = [
    { title: 'Bluey',           type: 'TV Show',         category: 'Animation',   ageRating: 'G',  description: 'A lovable Blue Heeler puppy and her imaginative family.',    whyRecommended: 'Gentle, positive family stories perfect for young viewers.',    platform: 'Disney+',  safetyScore: 99 },
    { title: 'Sesame Street',   type: 'TV Show',         category: 'Educational', ageRating: 'G',  description: 'Classic show teaching letters, numbers, and kindness.',       whyRecommended: 'Decades of proven educational value for early learners.',       platform: 'PBS Kids', safetyScore: 100 },
    { title: 'Peppa Pig',       type: 'TV Show',         category: 'Animation',   ageRating: 'G',  description: 'Fun everyday adventures with Peppa and her friends.',         whyRecommended: 'Simple, wholesome stories that build social skills.',           platform: 'YouTube',  safetyScore: 99 },
    { title: 'Numberblocks',    type: 'TV Show',         category: 'Educational', ageRating: 'G',  description: 'Number characters that teach maths in a fun visual way.',     whyRecommended: 'Outstanding early maths foundation through playful animation.', platform: 'BBC',      safetyScore: 100 },
    { title: 'Hey Duggee',      type: 'TV Show',         category: 'Animation',   ageRating: 'G',  description: 'Squirrel Club badges and exciting discoveries every episode.', whyRecommended: 'Encourages curiosity, teamwork, and a love of nature.',         platform: 'BBC',      safetyScore: 99 },
    { title: 'Story Time',      type: 'YouTube Channel', category: 'Stories',     ageRating: 'G',  description: 'Beautifully animated classic fairy tales and original stories.', whyRecommended: 'Builds vocabulary and imagination through storytelling.',      platform: 'YouTube',  safetyScore: 98 },
  ];

  const forOlder = [
    { title: 'National Geographic Kids', type: 'YouTube Channel', category: 'Science',     ageRating: 'G',  description: 'Stunning wildlife and nature facts for curious minds.',     whyRecommended: 'Sparks curiosity about the natural world.',                       platform: 'YouTube',  safetyScore: 98 },
    { title: 'SciShow Kids',             type: 'YouTube Channel', category: 'Educational', ageRating: 'G',  description: 'Science made fun with experiments and clear explanations.',  whyRecommended: 'Excellent STEM content that answers the "why" questions.',        platform: 'YouTube',  safetyScore: 99 },
    { title: 'Avatar: The Last Airbender', type: 'TV Show',       category: 'Animation',   ageRating: 'PG', description: 'Epic adventure with deep themes of friendship and courage.',  whyRecommended: 'Teaches perseverance, empathy, and moral decision-making.',       platform: 'Netflix',  safetyScore: 92 },
    { title: 'TED-Ed',                   type: 'YouTube Channel', category: 'Educational', ageRating: 'G',  description: 'Short animated lessons on science, history, and more.',     whyRecommended: 'Thought-provoking videos that expand knowledge on any subject.', platform: 'YouTube',  safetyScore: 97 },
    { title: 'Matilda the Musical',      type: 'Movie',           category: 'Stories',     ageRating: 'PG', description: 'A brilliant girl finds courage with the help of her teacher.', whyRecommended: 'Celebrates intelligence, kindness, and standing up for yourself.', platform: 'Netflix', safetyScore: 94 },
    { title: 'Spy Kids',                 type: 'Movie',           category: 'Animation',   ageRating: 'PG', description: 'Two kids become secret agents to rescue their parents.',      whyRecommended: 'Action-packed fun that celebrates family and teamwork.',          platform: 'Netflix', safetyScore: 90 },
  ];

  return age <= 7 ? forYoung : forOlder;
}

// ── Shared OpenAI call ─────────────────────────────────────────────────────
async function getAIRecommendations(child, userMessage, count = 6) {
  const restrictionContext = buildRestrictionContext(child);

  const systemPrompt = `You are KidsSafe AI, a children's content recommendation assistant.

CHILD PROFILE:
• Name: ${child.name}
• Age: ${child.age} years old

STRICT SAFETY RULES (NEVER violate these):
${restrictionContext}

RESPONSE FORMAT — return ONLY a valid JSON array of ${count} objects, no markdown, no extra text:
[
  {
    "title": "Show or Channel Name",
    "type": "TV Show | Movie | YouTube Channel | Educational Video | Podcast",
    "category": "Educational | Animation | Science | Nature | Sports | Arts | Stories | Music | Comedy",
    "ageRating": "G | PG | PG-13",
    "description": "Two-sentence friendly description suitable for a child.",
    "whyRecommended": "One sentence explaining why this is great for ${child.name}.",
    "platform": "Netflix | Disney+ | YouTube | PBS Kids | BBC | Cartoon Network | Other",
    "safetyScore": 95
  }
]

If the search query is inappropriate or unsafe, silently redirect and return safe alternatives on the same broad topic.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  // Strip possible markdown code fences from the response
  const raw = completion.choices[0].message.content.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(raw);
}

// ── POST /api/ai/search ────────────────────────────────────────────────────
// Body: { query: string, childId: number }
// Returns: { query, childName, recommendations[], generatedAt }
router.post('/search', async (req, res) => {
  try {
    const { query, childId } = req.body;

    if (!query || !childId) {
      return res.status(400).json({ error: 'query and childId are required.' });
    }

    // Load child profile + restrictions from DB
    const childResult = await db.query(
      `SELECT c.name, c.age,
              r.max_content_rating, r.allowed_categories, r.blocked_keywords,
              r.violence_level, r.allow_scary_content, r.educational_only, r.parent_notes
       FROM children c
       LEFT JOIN restrictions r ON c.id = r.child_id
       WHERE c.id = $1`,
      [childId]
    );

    if (childResult.rows.length === 0) {
      return res.status(404).json({ error: 'Child profile not found.' });
    }

    const child = childResult.rows[0];

    let recommendations;

    // Use real OpenAI when the API key is set; otherwise fall back gracefully
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        recommendations = await getAIRecommendations(child, `Find content for: "${query}"`, 6);
      } catch (aiErr) {
        console.warn('OpenAI error, using fallback:', aiErr.message);
        recommendations = fallbackRecommendations(child.age);
      }
    } else {
      // Demo mode — no API key needed
      recommendations = fallbackRecommendations(child.age);
    }

    // Persist search query + results for parental review
    await db.query(
      'INSERT INTO search_history (child_id, query, results) VALUES ($1, $2, $3)',
      [childId, query.trim(), JSON.stringify(recommendations)]
    ).catch(err => console.warn('History insert failed (DB may be offline):', err.message));

    res.json({
      query,
      childName: child.name,
      recommendations,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('AI search error:', error);
    res.status(500).json({ error: 'AI search service is temporarily unavailable.' });
  }
});

// ── GET /api/ai/suggestions/:childId ──────────────────────────────────────
// Personalised home-feed suggestions (no query needed)
// Returns: { childName, recommendations[], generatedAt }
router.get('/suggestions/:childId', async (req, res) => {
  try {
    const { childId } = req.params;

    const childResult = await db.query(
      `SELECT c.name, c.age,
              r.max_content_rating, r.allowed_categories, r.blocked_keywords,
              r.violence_level, r.allow_scary_content, r.educational_only, r.parent_notes
       FROM children c
       LEFT JOIN restrictions r ON c.id = r.child_id
       WHERE c.id = $1`,
      [childId]
    );

    if (childResult.rows.length === 0) {
      return res.status(404).json({ error: 'Child profile not found.' });
    }

    const child = childResult.rows[0];

    // Pull recent searches for personalisation
    const historyResult = await db.query(
      'SELECT query FROM search_history WHERE child_id = $1 ORDER BY created_at DESC LIMIT 5',
      [childId]
    ).catch(() => ({ rows: [] }));

    const recentInterests = historyResult.rows.map(r => r.query).join(', ') || 'general interests';

    let recommendations;
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        recommendations = await getAIRecommendations(
          child,
          `Suggest 8 personalised shows and videos for ${child.name}. Recent interests: ${recentInterests}.`,
          8
        );
      } catch (aiErr) {
        console.warn('OpenAI error, using fallback:', aiErr.message);
        recommendations = fallbackRecommendations(child.age);
      }
    } else {
      recommendations = fallbackRecommendations(child.age);
    }

    res.json({
      childName: child.name,
      recommendations,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Could not load suggestions.' });
  }
});

module.exports = router;
