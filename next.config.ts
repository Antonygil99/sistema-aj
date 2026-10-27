import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, async headers(){return [{source:'/completar',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Content-Security-Policy',value:"frame-ancestors 'none'"},{key:'X-Frame-Options',value:'DENY'}]}];} };
export default config;
