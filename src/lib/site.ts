/**
 * Site-wide constants. Contact details are transcribed verbatim from the
 * Center's old Drupal contact page — see TODO.md before changing any of them.
 */
export const SITE = {
  name: 'Center for Biomolecular Engineering',
  shortName: 'Center for Biomolecular Engineering',
  lab: "Dr. Zheng-Rong Lu's Group",
  department: 'Department of Biomedical Engineering',
  university: 'Case Western Reserve University',
  tagline:
    'Nanoplatforms for nucleic acid therapeutics and novel imaging agents for cancer and cardiovascular disease.',
  mission:
    'Case Center for Biomolecular Engineering seeks to develop cutting edge nanoplatforms for delivering nucleic acid therapeutics, and novel imaging agents to enable clinicians to better detect and alleviate the mortality and morbidity of life impairing or threatening diseases, including cancer.',
  // The opening sentence of Dr. Lu's original paragraph was cut so the
  // statement sits alongside the animation. "Further," was left dangling by
  // that cut and has been dropped — a grammatical consequence of the edit, not
  // a change of meaning. The full original is in TODO.md.
  missionExtended:
    'Our goal is to design and develop simple and smart biomolecules to target specific biological signatures for accurate detection and effective treatment of diseases.',
  videoId: 'ZuBWCxyAuM0',
  scholar:
    'https://scholar.google.com/citations?hl=en&user=hO6xhakAAAAJ&view_op=list_works&sortby=pubdate',
} as const;

export const CONTACT = {
  director: 'Dr. Zheng-Rong Lu',
  office: 'Wickenden 427',
  lab: 'Wickenden 408, 433-435',
  phone: '216-368-0187',
  phoneHref: '+12163680187',
  fax: '216-368-4969',
  email: 'zxl125@case.edu',
  altEmail: 'zheng-rong.lu@case.edu',
  instrumentsContact: 'Ryan Hall',
  instrumentsEmail: 'rch87@case.edu',
  mailing: [
    'Department of Biomedical Engineering',
    'Case Western Reserve University',
    'Wickenden 427, Mail Stop 7207',
    '10900 Euclid Avenue',
    'Cleveland, OH 44106',
  ],
} as const;

export const NAV = [
  { href: '/research', label: 'Research' },
  { href: '/people', label: 'People' },
  { href: '/publications', label: 'Publications' },
  { href: '/news', label: 'News' },
  { href: '/instruments', label: 'Instruments' },
  { href: '/join', label: 'Join' },
  { href: '/contact', label: 'Contact' },
] as const;
