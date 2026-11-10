export const reviewKinds={all:'Todo por revisar',catalog:'Producto de la póliza',policyOwner:'Responsable de póliza',productOwner:'Responsable de producto',schedule:'Calendario de recibos',renewal:'Cierre de renovación'} as const;
export type ReviewRow={id:string;entity:'policy'|'product';title:string;subtitle:string;issues:string[];href:string;action:string};
