/**
 * Language Detection Module for Per-Word Multi-Language TTS
 * 
 * This module provides word-level language detection capabilities to enable
 * automatic TTS voice switching for mixed-language text content.
 * 
 * Key Features:
 * - Detects language of individual words with confidence scoring
 * - Segments text into language-specific chunks for TTS processing
 * - Caches detection results for performance optimization
 * - Handles edge cases: URLs, numbers, punctuation, mixed scripts
 * 
 * Browser Compatibility:
 * - Uses Chrome's native LanguageDetector API (Chrome 130+) when available
 * - Falls back to heuristic-based detection for older browsers
 * - Gracefully degrades if language detection is unavailable
 */

(function() {
  'use strict';

  // Cache for language detection results to improve performance
  const detectionCache = new Map();
  const CACHE_MAX_SIZE = 1000;

  /**
   * Check if browser's native Language Detector API is available
   * @returns {boolean} True if API is available
   */
  function isLanguageDetectorAvailable() {
    return typeof translation !== 'undefined' && 
           typeof translation.createDetector === 'function';
  }

  /**
   * Detects the language of a single word with confidence scoring
   * 
   * @param {string} word - Single word to analyze
   * @param {Array<string>} expectedLangs - Array of likely languages (optimization hint)
   * @returns {Promise<Object>} Promise resolving to {lang: 'en', confidence: 0.95} or null
   */
  async function detectWordLanguage(word, expectedLangs = []) {
    // Handle empty or whitespace-only input
    if (!word || !word.trim()) {
      return null;
    }

    // Check cache first for performance
    const cacheKey = word.toLowerCase();
    if (detectionCache.has(cacheKey)) {
      return detectionCache.get(cacheKey);
    }

    try {
      // Try native browser API first
      if (isLanguageDetectorAvailable()) {
        const detector = await translation.createDetector();
        const results = await detector.detect(word);
        
        if (results && results.length > 0) {
          const topResult = results[0];
          const result = {
            lang: topResult.detectedLanguage,
            confidence: topResult.confidence
          };
          
          // Cache the result
          cacheResult(cacheKey, result);
          return result;
        }
      }
      
      // Fallback to heuristic detection
      const result = detectLanguageHeuristic(word, expectedLangs);
      cacheResult(cacheKey, result);
      return result;
      
    } catch (error) {
      console.warn('Language detection error for word:', word, error);
      // Return heuristic fallback on error
      const result = detectLanguageHeuristic(word, expectedLangs);
      cacheResult(cacheKey, result);
      return result;
    }
  }

  /**
   * Heuristic-based language detection fallback
   * Uses character ranges and common patterns to guess language
   * 
   * @param {string} word - Word to analyze
   * @param {Array<string>} expectedLangs - Expected languages
   * @returns {Object} Detection result with lang and confidence
   */
  function detectLanguageHeuristic(word, expectedLangs) {
    const text = word.trim();
    
    // Handle edge cases
    if (isNumber(text)) {
      return { lang: null, confidence: 1.0 }; // Numbers are language-neutral
    }
    
    if (isURL(text)) {
      return { lang: 'en', confidence: 0.6 }; // URLs typically use English
    }
    
    if (isPunctuation(text)) {
      return { lang: null, confidence: 1.0 }; // Punctuation is language-neutral
    }

    // Detect based on character scripts
    const scripts = detectScripts(text);
    
    // Greek script detection
    if (scripts.greek > 0.5) {
      return { lang: 'el', confidence: 0.9 };
    }
    
    // Cyrillic script detection (Russian, etc.)
    if (scripts.cyrillic > 0.5) {
      return { lang: 'ru', confidence: 0.8 };
    }
    
    // Arabic script detection
    if (scripts.arabic > 0.5) {
      return { lang: 'ar', confidence: 0.9 };
    }
    
    // Hebrew script detection
    if (scripts.hebrew > 0.5) {
      return { lang: 'he', confidence: 0.9 };
    }
    
    // CJK (Chinese, Japanese, Korean) detection
    if (scripts.cjk > 0.5) {
      // Simplified/Traditional Chinese is most common
      return { lang: 'zh', confidence: 0.7 };
    }
    
    // Latin script - default to English with lower confidence
    if (scripts.latin > 0.5) {
      return { lang: 'en', confidence: 0.6 };
    }
    
    // If no clear script detected, return null
    return { lang: null, confidence: 0.3 };
  }

  /**
   * Detect script types in text
   * @param {string} text - Text to analyze
   * @returns {Object} Proportion of each script type (0-1)
   */
  function detectScripts(text) {
    const len = text.length;
    let greek = 0, cyrillic = 0, arabic = 0, hebrew = 0, cjk = 0, latin = 0;
    
    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      
      // Greek: 0x0370-0x03FF
      if (code >= 0x0370 && code <= 0x03FF) greek++;
      // Cyrillic: 0x0400-0x04FF
      else if (code >= 0x0400 && code <= 0x04FF) cyrillic++;
      // Arabic: 0x0600-0x06FF
      else if (code >= 0x0600 && code <= 0x06FF) arabic++;
      // Hebrew: 0x0590-0x05FF
      else if (code >= 0x0590 && code <= 0x05FF) hebrew++;
      // CJK: 0x4E00-0x9FFF (Chinese), 0x3040-0x309F (Hiragana), 0x30A0-0x30FF (Katakana)
      else if ((code >= 0x4E00 && code <= 0x9FFF) || 
               (code >= 0x3040 && code <= 0x309F) || 
               (code >= 0x30A0 && code <= 0x30FF)) cjk++;
      // Latin: 0x0041-0x005A, 0x0061-0x007A, 0x00C0-0x024F
      else if ((code >= 0x0041 && code <= 0x005A) || 
               (code >= 0x0061 && code <= 0x007A) || 
               (code >= 0x00C0 && code <= 0x024F)) latin++;
    }
    
    return {
      greek: greek / len,
      cyrillic: cyrillic / len,
      arabic: arabic / len,
      hebrew: hebrew / len,
      cjk: cjk / len,
      latin: latin / len
    };
  }

  /**
   * Check if text is a number
   */
  function isNumber(text) {
    return /^[\d\s.,\-+()]+$/.test(text);
  }

  /**
   * Check if text is a URL
   */
  function isURL(text) {
    return /^(https?:\/\/|www\.|\w+\.(com|org|net|edu|gov|io|app))/i.test(text);
  }

  /**
   * Check if text is only punctuation
   */
  function isPunctuation(text) {
    return /^[^\w\s]+$/.test(text);
  }

  /**
   * Cache detection result with size management
   */
  function cacheResult(key, result) {
    if (detectionCache.size >= CACHE_MAX_SIZE) {
      // Remove oldest entry (first entry in Map)
      const firstKey = detectionCache.keys().next().value;
      detectionCache.delete(firstKey);
    }
    detectionCache.set(key, result);
  }

  /**
   * Segments text into language-specific chunks for TTS processing
   * 
   * @param {string} text - Input text to segment
   * @param {Object} options - Configuration options
   * @param {Array<string>} options.expectedLanguages - Likely languages in the text
   * @param {number} options.threshold - Minimum confidence threshold (0-1), default 0.7
   * @param {string} options.defaultLang - Default language when confidence is low
   * @returns {Promise<Array<Object>>} Array of {text: string, lang: string} segments
   * 
   * Example output:
   * [
   *   {text: "Καλημέρα ", lang: "el"},
   *   {text: "hello ", lang: "en"},
   *   {text: "κόσμος", lang: "el"}
   * ]
   */
  async function segmentTextByLanguage(text, options = {}) {
    const {
      expectedLanguages = [],
      threshold = 0.7,
      defaultLang = 'en'
    } = options;

    // Handle empty input
    if (!text || !text.trim()) {
      return [];
    }

    // Split text into tokens (words + punctuation) while preserving spacing
    const tokens = tokenizeText(text);
    const segments = [];
    let currentSegment = null;

    for (const token of tokens) {
      // Detect language of this token
      const detection = await detectWordLanguage(token.text, expectedLanguages);
      
      // Determine effective language for this token
      let tokenLang;
      if (!detection || detection.lang === null || detection.confidence < threshold) {
        // Use default language if confidence is too low
        tokenLang = defaultLang;
      } else {
        tokenLang = detection.lang;
      }

      // Batch consecutive same-language tokens into single segment
      if (currentSegment && currentSegment.lang === tokenLang) {
        // Add to current segment
        currentSegment.text += token.text + (token.space || '');
      } else {
        // Start new segment
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = {
          text: token.text + (token.space || ''),
          lang: tokenLang
        };
      }
    }

    // Add final segment
    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments;
  }

  /**
   * Tokenizes text into words and punctuation while preserving spacing
   * 
   * @param {string} text - Text to tokenize
   * @returns {Array<Object>} Array of {text: string, space: string} tokens
   */
  function tokenizeText(text) {
    const tokens = [];
    // Match words (including apostrophes for contractions) or punctuation
    const regex = /[\w'-]+|[^\w\s]+/gu;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const token = match[0];
      const startIndex = match.index;
      
      // Capture spacing before this token
      const space = text.substring(lastIndex + (tokens.length > 0 ? tokens[tokens.length - 1].text.length : 0), startIndex);
      
      if (tokens.length > 0) {
        tokens[tokens.length - 1].space = space;
      }
      
      tokens.push({
        text: token,
        space: ''
      });
      
      lastIndex = startIndex;
    }

    // Capture trailing space
    if (tokens.length > 0) {
      const lastToken = tokens[tokens.length - 1];
      const endIndex = lastIndex + lastToken.text.length;
      if (endIndex < text.length) {
        lastToken.space = text.substring(endIndex);
      }
    }

    return tokens;
  }

  /**
   * Clear the detection cache
   * Useful for testing or memory management
   */
  function clearCache() {
    detectionCache.clear();
  }

  // Export functions for use in other modules
  window.LanguageDetector = {
    detectWordLanguage,
    segmentTextByLanguage,
    clearCache,
    isLanguageDetectorAvailable
  };

})();
