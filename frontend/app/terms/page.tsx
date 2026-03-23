'use client';

import { H1_STYLE, TYPE } from '../lib/typography';
import { DS, SECTION_LABEL_STYLE } from '../lib/tokens';

export default function TermsPage() {
  const body: React.CSSProperties = {
    fontSize: TYPE.size.sm,
    color: DS.tertiary,
    lineHeight: TYPE.leading.loose,
    margin: '0 0 1rem 0',
  };

  const subSectionTitle: React.CSSProperties = {
    fontSize: TYPE.size.sm,
    fontWeight: 600,
    color: DS.tertiary,
    marginTop: '1.2rem',
    marginBottom: '0.5rem',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: DS.bg,
      padding: '80px 2.5rem 4rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* Page title — outside the card, left-aligned */}
      <div style={{ width: '100%', maxWidth: 900, marginBottom: '1.5rem' }}>
        <h1 style={H1_STYLE}>
          TERMS AND CONDITIONS
        </h1>
        <p style={{ opacity: 0.6, fontSize: TYPE.size.xs, marginTop: '0.5rem' }}>Last updated March 09, 2026</p>
      </div>

      {/* Main card */}
      <div style={{
        width: '100%',
        maxWidth: 900,
        background: '#fff',
        border: `3px solid ${DS.tertiary}`,
        boxShadow: DS.shadow,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '2.5rem 3.5rem',
      }}>

        <p style={body}>
          We are Near, a company registered in Germany at Porschestr. 2, Wolfsburg, Lower Saxony 38440. Our VAT number is 1234567890.
        </p>
        <p style={body}>
          We operate the website near.com (the &apos;Site&apos;), as well as any other related products and services that refer or link to these legal terms (the &apos;Legal Terms&apos;) (collectively, the &apos;Services&apos;).
        </p>
        <p style={body}>
          You can contact us by phone at +49 177 123 456 78, email at support@near, or by mail to Porschestr. 2, Wolfsburg, Lower Saxony 38440, Germany.
        </p>
        <p style={body}>
          These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&apos;you&apos;), and Near, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.
        </p>
        <p style={body}>
          We will provide you with prior notice of any scheduled changes to the Services you are using. The modified Legal Terms will become effective upon posting or notifying you by support@near.com, as stated in the email message. By continuing to use the Services after the effective date of any changes, you agree to be bound by the modified terms.
        </p>
        <p style={body}>
          The Services are intended for users who are at least 13 years of age. All users who are minors in the jurisdiction in which they reside (generally under the age of 18) must have the permission of, and be directly supervised by, their parent or guardian to use the Services. If you are a minor, you must have your parent or guardian read and agree to these Legal Terms prior to you using the Services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>1. OUR SERVICES</h3>
        <p style={body}>
          The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country.
        </p>
        <p style={body}>
          The Services are not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (GLBA).
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>2. INTELLECTUAL PROPERTY RIGHTS</h3>
        <p style={subSectionTitle}>Our intellectual property</p>
        <p style={body}>
          We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the &apos;Content&apos;), as well as the trademarks, service marks, and logos contained therein (the &apos;Marks&apos;).
        </p>
        <p style={body}>
          Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world.
        </p>

        <p style={subSectionTitle}>Your use of our Services</p>
        <p style={body}>
          Subject to your compliance with these Legal Terms, including the &apos;PROHIBITED ACTIVITIES&apos; section below, we grant you a non-exclusive, non-transferable, revocable licence to access the Services and download or print a copy of any portion of the Content to which you have properly gained access, solely for your personal, non-commercial use or internal business purpose.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>3. USER REPRESENTATIONS</h3>
        <p style={body}>
          By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) you are not under the age of 13; (5) you are not a minor in the jurisdiction in which you reside, or if a minor, you have received parental permission to use the Services; (6) you will not access the Services through automated or non-human means; (7) you will not use the Services for any illegal or unauthorised purpose; and (8) your use of the Services will not violate any applicable law or regulation.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>4. USER REGISTRATION</h3>
        <p style={body}>
          You may be required to register to use the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>5. PROHIBITED ACTIVITIES</h3>
        <p style={body}>
          You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavours except those that are specifically endorsed or approved by us.
        </p>
        <ul style={{ ...body, paddingLeft: '1.5rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>Systematically retrieve data or other content from the Services to create or compile a collection, database, or directory.</li>
          <li style={{ marginBottom: '0.5rem' }}>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information.</li>
          <li style={{ marginBottom: '0.5rem' }}>Circumvent, disable, or otherwise interfere with security-related features of the Services.</li>
          <li style={{ marginBottom: '0.5rem' }}>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
          <li style={{ marginBottom: '0.5rem' }}>Use any information obtained from the Services in order to harass, abuse, or harm another person.</li>
          <li style={{ marginBottom: '0.5rem' }}>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
        </ul>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>6. USER GENERATED CONTRIBUTIONS</h3>
        <p style={body}>
          The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>7. CONTRIBUTION LICENCE</h3>
        <p style={body}>
          By posting your Contributions to any part of the Services, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and licence to host, use, copy, reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, cache, publicly perform, publicly display, reformat, translate, transmit, excerpt (in whole or in part), and distribute such Contributions.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>8. SERVICES MANAGEMENT</h3>
        <p style={body}>
          We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable any of your Contributions.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>9. PRIVACY POLICY</h3>
        <p style={body}>
          We care about data privacy and security. Please review our Privacy Policy: near.com/privacy. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>10. COPYRIGHT INFRINGEMENTS</h3>
        <p style={body}>
          We respect the intellectual property rights of others. If you believe that any material available on or through the Services infringes upon any copyright you own or control, please immediately notify us.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>11. TERM AND TERMINATION</h3>
        <p style={body}>
          These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>12. MODIFICATIONS AND INTERRUPTIONS</h3>
        <p style={body}>
          We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>13. GOVERNING LAW</h3>
        <p style={body}>
          These Legal Terms are governed by and interpreted following the laws of Germany. Near and yourself both agree to submit to the non-exclusive jurisdiction of the courts of Wolfsburg.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>14. DISPUTE RESOLUTION</h3>
        <p style={subSectionTitle}>Informal Negotiations</p>
        <p style={body}>
          To expedite resolution and control the cost of any dispute, the Parties agree to first attempt to negotiate any Dispute informally for at least thirty (30) days before initiating arbitration.
        </p>
        <p style={subSectionTitle}>Binding Arbitration</p>
        <p style={body}>
          Any dispute arising from the relationships between the Parties to these Legal Terms shall be determined by one arbitrator who will be chosen in accordance with the Arbitration and Internal Rules of the European Court of Arbitration.
        </p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>15. CORRECTIONS</h3>
        <p style={body}>There may be information on the Services that contains typographical errors, inaccuracies, or omissions. We reserve the right to correct any errors, inaccuracies, or omissions.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>16. DISCLAIMER</h3>
        <p style={body}>THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>17. LIMITATIONS OF LIABILITY</h3>
        <p style={body}>IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>18. INDEMNIFICATION</h3>
        <p style={body}>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>19. USER DATA</h3>
        <p style={body}>We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>20. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h3>
        <p style={body}>Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>21. SMS TEXT MESSAGING</h3>
        <p style={body}>By opting into any near text messaging program, you expressly consent to receive text messages (SMS) to your mobile number.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>22. CALIFORNIA USERS AND RESIDENTS</h3>
        <p style={body}>If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>23. MISCELLANEOUS</h3>
        <p style={body}>These Legal Terms and any policies or operating rules posted by us on the Services constitute the entire agreement and understanding between you and us.</p>

        <h3 style={{ ...SECTION_LABEL_STYLE, opacity: 0.45, marginTop: '2rem' }}>24. CONTACT US</h3>
        <div style={{ ...body, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Near</span>
          <span>Porschestr. 2</span>
          <span>Wolfsburg, Lower Saxony 38440</span>
          <span>Germany</span>
          <span>Phone: +49 177 123 456 78</span>
          <span>support@near</span>
        </div>

      </div>
    </div>
  );
}
