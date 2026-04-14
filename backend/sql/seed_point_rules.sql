-- Seed point_rules table with entries that mirror the frontend registry.
-- Run after points_schema.sql. Uses UPSERT so it is idempotent.

INSERT INTO point_rules (id, label, description, category, points, metadata)
VALUES
    (
        'open-solitaire',
        'Open Solitaire',
        'Launch the Solitaire application from any entry point.',
        'application',
        10,
        '{"limit":{"type":"perSession","maxAwards":1},"appId":"solitaire"}'::jsonb
    ),
    (
        'create-desktop-folder',
        'Create a Desktop Folder',
        'Use File Explorer to create a new folder on the desktop.',
        'system',
        8,
        '{"limit":{"type":"perSession","maxAwards":3}}'::jsonb
    ),
    (
        'delete-browser-history',
        'Delete Browser History',
        'Clear the history inside the Internet Explorer experience.',
        'system',
        6,
        '{"limit":{"type":"perDay","maxAwards":1}}'::jsonb
    ),
    (
        'create-my-computer-shortcut',
        'Create My Computer Shortcut',
        'Place a shortcut to My Computer on the desktop and keep it there.',
        'system',
        5,
        '{"limit":{"type":"perSession","maxAwards":1},"targetAppId":"computer"}'::jsonb
    ),
    (
        'open-in-the-end',
        'Play "In The End.mp3"',
        'Launch and play the In The End audio file.',
        'application',
        7,
        '{"limit":{"type":"perSession","maxAwards":2},"fileId":"inTheEnd"}'::jsonb
    ),
    (
        'restart-computer',
        'Restart the Computer',
        'Trigger a restart via the shutdown modal and return to the desktop.',
        'system',
        12,
        '{"limit":{"type":"perSession","maxAwards":1}}'::jsonb
    ),
    (
        'visit-neopets',
        'Visit Neopets',
        'Open the browser and navigate to neopets.com.',
        'application',
        6,
        '{"limit":{"type":"perSession","maxAwards":1},"url":"https://www.neopets.com"}'::jsonb
    ),
    (
        'locate-minecraft-folder',
        'Locate .minecraft Folder',
        'Find and open the .minecraft folder via File Explorer.',
        'challenge',
        9,
        '{"limit":{"type":"perSession","maxAwards":1}}'::jsonb
    ),
    (
        'open-bonzi-buddy',
        'Open Bonzi Buddy',
        'Launch Bonzi Buddy.',
        'application',
        8,
        '{"limit":{"type":"perSession","maxAwards":1}}'::jsonb
    ),
    (
        'open-soundboard',
        'Use Napoleon Dynamite Soundboard',
        'Open and trigger at least one sound in the Napoleon Dynamite soundboard.',
        'application',
        8,
        '{"limit":{"type":"perSession","maxAwards":1}}'::jsonb
    ),
    (
        'find-windows11',
        'Find windows_11.exe',
        'Locate the hidden windows_11.exe file.',
        'challenge',
        15,
        '{"limit":{"type":"perSession","maxAwards":1},"fileId":"win11"}'::jsonb
    ),
    (
        'delete-system32',
        'Attempt to Delete System32',
        'Reach the prompt that threatens to delete System32.',
        'challenge',
        20,
        '{"limit":{"type":"perSession","maxAwards":1}}'::jsonb
    ),
    (
        'click-100',
        'Click Frenzy 100x',
        'Complete the 100-click challenge.',
        'challenge',
        5,
        '{"limit":{"type":"perSession","maxAwards":1},"threshold":100}'::jsonb
    ),
    (
        'click-1000',
        'Click Frenzy 1,000x',
        'Complete the 1,000-click challenge.',
        'challenge',
        12,
        '{"limit":{"type":"perSession","maxAwards":1},"threshold":1000}'::jsonb
    ),
    (
        'click-10000',
        'Click Frenzy 10,000x',
        'Complete the 10,000-click challenge.',
        'challenge',
        30,
        '{"limit":{"type":"perLifetime","maxAwards":1},"threshold":10000}'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    points = EXCLUDED.points,
    metadata = EXCLUDED.metadata,
    version = point_rules.version + 1,
    created_at = point_rules.created_at;
