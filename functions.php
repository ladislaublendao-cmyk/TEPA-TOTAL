<?php
/**
 * TEPA Performance Award 2026 ("Light Up") — Theme Functions & Setup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TEPA_THEME_VERSION', '1.12.3' );
define( 'TEPA_DEFAULT_SUPABASE_URL', 'https://ujpzqulgainzxxombrgb.supabase.co' );
define( 'TEPA_DEFAULT_SUPABASE_KEY', 'sb_publishable_cuReE7bA6g0vdzdJQCPWJQ_oPCuxzxM' );

add_filter( 'show_admin_bar', '__return_false' );

require_once get_template_directory() . '/inc/admin-settings.php';

/**
 * Enable theme supports.
 */
function tepa_theme_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'html5', array( 'style', 'script' ) );
}
add_action( 'after_setup_theme', 'tepa_theme_setup' );

/**
 * Resolve page URL for a given TEPA view slug, falling back to query-param route.
 */
function tepa_get_view_url( $slug ) {
	$page = get_page_by_path( $slug );
	if ( $page && 'publish' === $page->post_status ) {
		return get_permalink( $page->ID );
	}
	return add_query_arg( 'view', $slug, home_url( '/' ) );
}

/**
 * Build public runtime config passed to frontend JS.
 */
function tepa_get_runtime_config() {
	$raw_url      = trim( (string) get_option( 'tepa_supabase_url', '' ) );
	$raw_key      = trim( (string) get_option( 'tepa_supabase_anon_key', '' ) );
	$supabase_url = '' !== $raw_url ? $raw_url : TEPA_DEFAULT_SUPABASE_URL;
	$supabase_key = '' !== $raw_key ? $raw_key : TEPA_DEFAULT_SUPABASE_KEY;
	$force_demo   = (bool) get_option( 'tepa_force_demo', false );
	$is_wp_admin  = is_admin() && is_user_logged_in() && current_user_can( 'manage_options' );
	$current_user = $is_wp_admin ? wp_get_current_user() : null;
	$req_tab      = ( $is_wp_admin && isset( $_GET['tab'] ) ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';

	return array(
		'supabaseUrl'     => $supabase_url,
		'supabaseAnonKey' => $supabase_key,
		'forceDemo'       => $force_demo || ( empty( $supabase_url ) || empty( $supabase_key ) ),
		'rawForceDemo'    => $force_demo,
		'isWpAdmin'       => $is_wp_admin,
		'requireWpAdmin'  => true,
		'wpUserDisplay'   => $current_user ? $current_user->display_name : '',
		'wpDashboardUrl'  => admin_url( 'index.php' ),
		'wpAdminTab'      => $req_tab,
		'wpLocale'        => function_exists( 'get_user_locale' ) ? get_user_locale() : get_locale(),
		'defaultPin'      => $is_wp_admin ? (string) get_option( 'tepa_admin_pin', '2026' ) : '',
		'assetsBase'      => get_template_directory_uri() . '/assets',
		'homeUrl'         => home_url( '/' ),
		'quizUrl'         => tepa_get_view_url( 'quiz' ),
		'voteUrl'         => tepa_get_view_url( 'vote' ),
		'liveUrl'         => tepa_get_view_url( 'live' ),
		'adminUrl'        => admin_url( 'admin.php?page=tepa-award-2026' ),
		'emailEndpoint'   => rest_url( 'tepa/v1/send-quiz-code' ),
		'emailNonce'      => wp_create_nonce( 'wp_rest' ),
	);
}

function tepa_asset_ver( $rel_path ) {
	$full = get_template_directory() . '/' . ltrim( $rel_path, '/' );
	return file_exists( $full ) ? (string) filemtime( $full ) : TEPA_THEME_VERSION;
}

/**
 * Enqueue frontend styles & scripts.
 */
function tepa_enqueue_assets() {
	$theme_uri = get_template_directory_uri();

	wp_enqueue_style(
		'tepa-award-style',
		$theme_uri . '/assets/css/tepa.css',
		array(),
		tepa_asset_ver( 'assets/css/tepa.css' )
	);

	wp_enqueue_script(
		'tepa-qrcode',
		$theme_uri . '/assets/js/qrcode.min.js',
		array(),
		tepa_asset_ver( 'assets/js/qrcode.min.js' ),
		true
	);

	wp_enqueue_script(
		'tepa-data',
		$theme_uri . '/assets/js/tepa-data.js',
		array( 'tepa-qrcode' ),
		tepa_asset_ver( 'assets/js/tepa-data.js' ),
		true
	);

	wp_localize_script( 'tepa-data', 'TEPA_CONFIG', tepa_get_runtime_config() );

	$app_deps = array( 'tepa-data', 'tepa-qrcode' );
	if ( is_admin() ) {
		wp_enqueue_script(
			'tepa-admin-i18n',
			$theme_uri . '/assets/js/tepa-admin-i18n.js',
			array(),
			tepa_asset_ver( 'assets/js/tepa-admin-i18n.js' ),
			true
		);
		$app_deps[] = 'tepa-admin-i18n';
	}

	wp_enqueue_script(
		'tepa-app',
		$theme_uri . '/assets/js/tepa-app.js',
		$app_deps,
		tepa_asset_ver( 'assets/js/tepa-app.js' ),
		true
	);
}
add_action( 'wp_enqueue_scripts', 'tepa_enqueue_assets' );

/**
 * Enqueue same assets inside the TEPA WP-Admin dashboard page.
 */
function tepa_enqueue_admin_assets( $hook_suffix ) {
	if ( false === strpos( (string) $hook_suffix, 'tepa-award-2026' ) ) {
		return;
	}
	tepa_enqueue_assets();
}
add_action( 'admin_enqueue_scripts', 'tepa_enqueue_admin_assets' );

/**
 * Automatically create Quiz, Vote, and Live pages on theme activation.
 */
function tepa_create_event_pages() {
	$pages = array(
		array(
			'slug'     => 'quiz',
			'title'    => 'TEPA Quiz',
			'template' => 'template-quiz.php',
		),
		array(
			'slug'     => 'vote',
			'title'    => 'TEPA Voting',
			'template' => 'template-vote.php',
		),
		array(
			'slug'     => 'live',
			'title'    => 'TEPA Live Results',
			'template' => 'template-live.php',
		),
	);

	foreach ( $pages as $item ) {
		$existing = get_page_by_path( $item['slug'] );
		if ( ! $existing ) {
			$page_id = wp_insert_post(
				array(
					'post_title'   => $item['title'],
					'post_name'    => $item['slug'],
					'post_status'  => 'publish',
					'post_type'    => 'page',
					'post_content' => '',
				)
			);
			if ( $page_id && ! is_wp_error( $page_id ) ) {
				update_post_meta( $page_id, '_wp_page_template', $item['template'] );
			}
		} else {
			update_post_meta( $existing->ID, '_wp_page_template', $item['template'] );
		}
	}

	flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'tepa_create_event_pages' );

/**
 * Register REST API endpoint to automatically email a participant's quiz access code.
 */
function tepa_register_rest_routes() {
	register_rest_route(
		'tepa/v1',
		'/send-quiz-code',
		array(
			'methods'             => 'POST',
			'callback'            => 'tepa_rest_send_quiz_code',
			'permission_callback' => '__return_true',
		)
	);
}
add_action( 'rest_api_init', 'tepa_register_rest_routes' );

/**
 * Build branded HTML email body containing the participant's unique access code.
 * Never includes quiz score or pass/fail status.
 */
function tepa_build_access_code_email_html( $full_name, $unique_code, $event_title ) {
	$safe_name  = esc_html( $full_name );
	$safe_code  = esc_html( $unique_code );
	$safe_event = esc_html( $event_title );
	$sent_at    = esc_html( wp_date( 'd/m/Y H:i' ) );

	return '<!DOCTYPE html>'
		. '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
		. '<title>' . $safe_event . ': Access Code</title></head>'
		. '<body style="margin:0;padding:0;background-color:#0B0C14;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;color:#141624;">'
		. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0B0C14;padding:28px 14px;">'
		. '<tr><td align="center">'
		. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 18px 42px rgba(0,0,0,0.35);">'
		. '<tr><td style="background-color:#0F1019;padding:28px 28px 24px;text-align:center;">'
		. '<div style="font-size:24px;font-weight:800;letter-spacing:0.14em;color:#FFFFFF;margin-bottom:6px;">LIGHT UP</div>'
		. '<div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#B8BCD0;">' . $safe_event . '</div>'
		. '</td></tr>'
		. '<tr><td style="height:5px;background:linear-gradient(90deg,#F77B39 0%,#8F4F9E 28%,#2194D4 55%,#64BD75 78%,#FFD239 100%);font-size:0;line-height:0;">&nbsp;</td></tr>'
		. '<tr><td style="padding:30px 28px 26px;">'
		. '<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#141624;">Hello <strong>' . $safe_name . '</strong>,</p>'
		. '<p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#4B5066;">Thank you for participating in the Welcome Quiz! Below is your unique participant access code. Please keep this email safe for verification at the Prize Desk when winners are announced live on the auditorium screen.</p>'
		. '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#141624;border:2px dashed #FFD239;border-radius:14px;margin:0 0 22px;">'
		. '<tr><td style="padding:22px 18px;text-align:center;">'
		. '<div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#C7C9D9;margin-bottom:8px;">UNIQUE ACCESS CODE · CÓDIGO DE ACESSO</div>'
		. '<div style="font-size:32px;font-weight:800;letter-spacing:0.12em;color:#FFD239;font-family:\'Courier New\',Courier,monospace;">' . $safe_code . '</div>'
		. '</td></tr></table>'
		. '<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#4B5066;"><strong>Participant:</strong> ' . $safe_name . '</p>'
		. '<p style="margin:0 0 18px;font-size:13px;line-height:1.55;color:#4B5066;"><strong>Issued:</strong> ' . $sent_at . '</p>'
		. '<div style="padding:14px 16px;background-color:#F7F8FC;border:1px solid #E2E6F0;border-radius:10px;font-size:12px;line-height:1.55;color:#5B6075;">'
		. 'Olá <strong>' . $safe_name . '</strong>, guarde este e-mail com o seu código de acesso <strong>' . $safe_code . '</strong> para apresentação na mesa de prémios após o anúncio dos vencedores.'
		. '</div>'
		. '</td></tr>'
		. '<tr><td style="padding:16px 28px 22px;background-color:#F8F9FC;border-top:1px solid #ECEFF5;text-align:center;font-size:11px;color:#7B8196;">'
		. 'TotalEnergies EP Angola · ' . $safe_event
		. '</td></tr>'
		. '</table>'
		. '</td></tr></table>'
		. '</body></html>';
}

/**
 * Verify that an access code belongs to the given email in the current Supabase quiz epoch.
 *
 * @return string|false|WP_Error Verified participant name, false if mismatched, or WP_Error if verification failed.
 */
function tepa_verify_quiz_code_owner( $unique_code, $email ) {
	$cfg = tepa_get_runtime_config();
	if ( ! empty( $cfg['forceDemo'] ) || empty( $cfg['supabaseUrl'] ) || empty( $cfg['supabaseAnonKey'] ) ) {
		return new WP_Error( 'tepa_verify_unavailable', 'unavailable' );
	}

	$endpoint = rtrim( (string) $cfg['supabaseUrl'], '/' ) . '/rest/v1/rpc/tepa_verify_quiz_code';
	$key      = (string) $cfg['supabaseAnonKey'];

	$response = wp_remote_post(
		$endpoint,
		array(
			'timeout' => 8,
			'headers' => array(
				'apikey'        => $key,
				'Authorization' => 'Bearer ' . $key,
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode(
				array(
					'p_unique_code' => $unique_code,
					'p_email'       => $email,
				)
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$status = (int) wp_remote_retrieve_response_code( $response );
	if ( 200 !== $status ) {
		return new WP_Error( 'tepa_verify_http_error', 'Unexpected verification status.' );
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $data ) ) {
		return new WP_Error( 'tepa_verify_invalid_json', 'Invalid verification response.' );
	}

	if ( ! empty( $data['ok'] ) ) {
		$verified_name = isset( $data['full_name'] ) ? sanitize_text_field( trim( (string) $data['full_name'] ) ) : '';
		return '' !== $verified_name ? $verified_name : 'Participant';
	}

	return false;
}

/**
 * REST callback: POST /wp-json/tepa/v1/send-quiz-code
 */
function tepa_rest_send_quiz_code( WP_REST_Request $request ) {
	// 1. Same-origin / Referer check when header is present (blocks external cross-site abuse)
	$site_host = wp_parse_url( home_url(), PHP_URL_HOST );
	$origin    = (string) $request->get_header( 'origin' );
	$referer   = (string) $request->get_header( 'referer' );
	if ( '' !== $origin && '' !== $site_host ) {
		$origin_host = wp_parse_url( $origin, PHP_URL_HOST );
		if ( $origin_host && strtolower( (string) $origin_host ) !== strtolower( (string) $site_host ) ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => 'Cross-origin email dispatch is not permitted.',
				),
				403
			);
		}
	} elseif ( '' !== $referer && '' !== $site_host ) {
		$ref_host = wp_parse_url( $referer, PHP_URL_HOST );
		if ( $ref_host && strtolower( (string) $ref_host ) !== strtolower( (string) $site_host ) ) {
			return new WP_REST_Response(
				array(
					'ok'    => false,
					'error' => 'Cross-origin email dispatch is not permitted.',
				),
				403
			);
		}
	}

	// 2. Verify X-WP-Nonce if provided by the client
	$nonce = (string) $request->get_header( 'x_wp_nonce' );
	if ( '' !== $nonce && ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Invalid or expired security token. Please reload the page.',
			),
			403
		);
	}

	// 3. Auditorium-safe per-IP ceiling (120 emails / 10 min per IP)
	$client_ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
	$ip_key    = 'tepa_mail_ip_' . md5( $client_ip );
	$ip_count  = (int) get_transient( $ip_key );
	if ( $ip_count >= 120 ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Email rate limit reached. Please try again in a few minutes.',
			),
			429
		);
	}

	$params = $request->get_json_params();
	if ( ! is_array( $params ) || empty( $params ) ) {
		$params = $request->get_params();
	}

	$email        = sanitize_email( trim( (string) ( isset( $params['email'] ) ? $params['email'] : '' ) ) );
	$full_name    = sanitize_text_field( trim( (string) ( isset( $params['full_name'] ) ? $params['full_name'] : '' ) ) );
	$unique_code  = strtoupper( sanitize_text_field( trim( (string) ( isset( $params['unique_code'] ) ? $params['unique_code'] : '' ) ) ) );
	$event_title  = sanitize_text_field( trim( (string) ( isset( $params['event_title'] ) ? $params['event_title'] : '' ) ) );
	$force_resend = ! empty( $params['resend'] );

	if ( '' === $email || ! is_email( $email ) ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Please provide a valid email address.',
			),
			400
		);
	}

	if ( ! preg_match( '/^TEPA-[A-Z0-9]{6}$/', $unique_code ) ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Invalid access code format.',
			),
			400
		);
	}

	if ( '' === $full_name ) {
		$full_name = 'Participant';
	}
	if ( '' === $event_title ) {
		$event_title = 'TEPA Performance Award 2026';
	}

	$verified = tepa_verify_quiz_code_owner( $unique_code, $email );
	if ( is_wp_error( $verified ) ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Could not verify your access code right now. Please save your code or download your PDF receipt.',
			),
			503
		);
	}
	if ( false === $verified ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'This access code does not match this email address.',
			),
			403
		);
	}
	$full_name = $verified;

	$email_lc   = strtolower( $email );
	$dedupe_key = 'tepa_mail_sent_' . md5( $email_lc . '|' . $unique_code );

	if ( ! $force_resend && get_transient( $dedupe_key ) ) {
		return new WP_REST_Response(
			array(
				'ok'           => true,
				'sent'         => true,
				'already_sent' => true,
			),
			200
		);
	}

	$rate_key   = 'tepa_mail_rate_' . md5( $email_lc );
	$rate_count = (int) get_transient( $rate_key );
	if ( $rate_count >= 5 ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'error' => 'Too many email requests for this address. Please try again shortly.',
			),
			429
		);
	}

	$subject = sprintf( '[TEPA 2026] Your Access Code: %s', $unique_code );
	$html    = tepa_build_access_code_email_html( $full_name, $unique_code, $event_title );
	$headers = array( 'Content-Type: text/html; charset=UTF-8' );

	$sent = wp_mail( $email, $subject, $html, $headers );

	if ( ! $sent ) {
		return new WP_REST_Response(
			array(
				'ok'    => false,
				'sent'  => false,
				'error' => 'Could not deliver the email right now. Please save your code or download your PDF receipt.',
			),
			500
		);
	}

	set_transient( $dedupe_key, 1, DAY_IN_SECONDS );
	set_transient( $rate_key, $rate_count + 1, 10 * MINUTE_IN_SECONDS );
	set_transient( $ip_key, $ip_count + 1, 10 * MINUTE_IN_SECONDS );

	return new WP_REST_Response(
		array(
			'ok'           => true,
			'sent'         => true,
			'already_sent' => false,
		),
		200
	);
}
