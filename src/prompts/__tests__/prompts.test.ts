import {
  buildImprovePrompt,
  buildSocialPrompt,
  IMPROVE_INSTRUCTIONS,
  PLATFORM_GUIDANCE,
} from '../prompts';

describe('prompt builders', () => {
  it('includes the action instruction and the source text', () => {
    const prompt = buildImprovePrompt({text: 'helo wrld', action: 'fix'});
    expect(prompt).toContain(IMPROVE_INSTRUCTIONS.fix);
    expect(prompt).toContain('helo wrld');
  });

  it('adds platform guidance only when a non-generic platform is given', () => {
    const withPlatform = buildImprovePrompt({
      text: 'hi',
      action: 'concise',
      platform: 'x',
    });
    expect(withPlatform).toContain(PLATFORM_GUIDANCE.x);

    const generic = buildImprovePrompt({
      text: 'hi',
      action: 'concise',
      platform: 'generic',
    });
    expect(generic).not.toContain(PLATFORM_GUIDANCE.x);
  });

  it('requests the right number of social variations and a separator', () => {
    const prompt = buildSocialPrompt({
      content: 'launch news',
      platform: 'linkedin',
      tone: 'marketing',
      variations: 3,
      includeHashtags: true,
    });
    expect(prompt).toContain('Generate 3 distinct LINKEDIN');
    expect(prompt).toContain('"---"');
    expect(prompt).toContain('Include relevant hashtags');
  });
});
