/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export enum Direction {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface Problem {
  /** @format uri */
  instance?: string;
  /** @format uri */
  type?: string;
  title?: string;
  detail?: string;
  /** @format int32 */
  status?: number;
}

export interface CompletionData {
  /**
   * When the BankID was issued
   * @format date
   */
  bankIdIssueDate?: string;
  /**
   * The signature made by the receiving party
   * @minLength 1
   */
  signature: string;
  /** Online certificate status protocol for the signing order */
  ocspResponse?: string;
  /** Indicates the risk level of the order based on data available in the order */
  risk?: string;
  /** Information regarding the signing party */
  user: User;
  /** Information regarding the device used for the signing order */
  device: Device;
  /** Information about possible additional verifications that were part of the signing order */
  stepUp?: StepUp;
}

/** CreateMandate model */
export interface CreateMandate {
  /** Mandate grantor information */
  grantorDetails: GrantorDetails;
  /** List of grantees */
  granteeDetails: GranteeDetails;
  /**
   * The date when the mandate becomes effective
   * @format date
   */
  activeFrom: string;
  /**
   * The date after which the mandate is no longer valid, if not provided it will be set to activeFrom + 36 months
   * @format date
   */
  inactiveAfter?: string;
  /** Signing information related to the mandate */
  signingInfo?: SigningInfo;
}

export interface Device {
  /**
   * Ip address used when the letter was signed
   * @minLength 1
   */
  ipAddress: string;
  /** The Unique Hardware Identifier for the user’s device holding the BankID */
  uhi?: string;
}

/** GranteeDetails model */
export interface GranteeDetails {
  /** PartyId of the grantee */
  partyId: string;
}

/** GrantorDetails model */
export interface GrantorDetails {
  /** The name of the granting organization or person */
  name?: string;
  /** The partyId of the issuing organization or person */
  grantorPartyId: string;
  /** PartyId of the issuing person / signatory */
  signatoryPartyId: string;
}

/** SigningInfo model */
export interface SigningInfo {
  /**
   * Reference for the signing order
   * @minLength 1
   */
  orderRef: string;
  /**
   * External transactionId
   * @minLength 1
   */
  externalTransactionId: string;
  /**
   * Status of the signing order
   * @minLength 1
   */
  status: string;
  /** Information about the user and the completed order */
  completionData: CompletionData;
}

export interface StepUp {
  /** Whether an MRTD check was performed before the order was completed */
  mrtd?: boolean;
}

export interface User {
  /**
   * Personal identity number for the signing party
   * @minLength 1
   */
  personalNumber: string;
  /** Full name of the signing party */
  name?: string;
  /**
   * First name of the signing party
   * @minLength 1
   */
  givenName: string;
  /**
   * Last name of the signing party
   * @minLength 1
   */
  surname: string;
}

export interface ConstraintViolationProblem {
  /** @format uri */
  type?: string;
  /** @format int32 */
  status?: number;
  violations?: Violation[];
  title?: string;
  /** @format uri */
  instance?: string;
  detail?: string;
  causeAsProblem?: ThrowableProblem;
}

export interface ThrowableProblem {
  /** @format uri */
  type?: string;
  title?: string;
  /** @format int32 */
  status?: number;
  detail?: string;
  /** @format uri */
  instance?: string;
  causeAsProblem?: any;
}

export interface Violation {
  field?: string;
  message?: string;
}

/** SearchMandateParameters model */
export interface SearchMandateParameters {
  /**
   * Page number
   * @format int32
   * @min 1
   * @default 1
   */
  page?: number;
  /**
   * Result size per page. Maximum allowed value is dynamically configured
   * @format int32
   * @min 1
   */
  limit?: number;
  /** The partyId of the issuing organization or person */
  grantorPartyId?: string;
  /** PartyId of the grantee */
  granteePartyId?: string;
  /** PartyId of the issuing person / signatory */
  signatoryPartyId?: string;
  /** List of mandate statuses */
  statuses?: string[];
}

/** MandateDetails model */
export interface MandateDetails {
  /** Id of the mandate */
  id?: string;
  /** Mandate grantor details */
  grantorDetails?: GrantorDetails;
  /** Mandate grantee details */
  granteeDetails?: GranteeDetails;
  /** MunicipalityId where the mandate was created */
  municipalityId?: string;
  /** The namespace in which the mandate is valid */
  namespace?: string;
  /**
   * The date and time when the mandate was created
   * @format date-time
   */
  created?: string;
  /**
   * The date and time when the mandate was changed
   * @format date-time
   */
  updated?: string;
  /**
   * The date when the mandate becomes effective
   * @format date
   */
  activeFrom?: string;
  /**
   * The date after which the mandate is no longer valid
   * @format date
   */
  inactiveAfter?: string;
  /** Indicates whether the mandate is active or not */
  status?: string;
  /** Signing information related to the mandate */
  signingInfo?: SigningInfo;
  /** Indicates whether the mandate was created through a whitelisted process */
  whitelisted?: boolean;
}

/** Paginated response containing a list of mandate details */
export interface Mandates {
  /** List of mandates */
  mandateDetailsList?: MandateDetails[];
  /** PagingAndSortingMetaData model */
  _meta?: PagingAndSortingMetaData;
}

/** PagingAndSortingMetaData model */
export interface PagingAndSortingMetaData {
  /**
   * Current page
   * @format int32
   */
  page?: number;
  /**
   * Displayed objects per page
   * @format int32
   */
  limit?: number;
  /**
   * Displayed objects on current page
   * @format int32
   */
  count?: number;
  /**
   * Total amount of hits based on provided search parameters
   * @format int64
   */
  totalRecords?: number;
  /**
   * Total amount of pages based on provided search parameters
   * @format int32
   */
  totalPages?: number;
  sortBy?: string[];
  /** The sort order direction */
  sortDirection?: Direction;
}
